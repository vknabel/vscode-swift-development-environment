import * as convert from "xml-js";

interface Text {
  type: "cdata";
  cdata: string;
}
interface Data {
  type: "text";
  text: string;
}

interface ParentOf<T> {
  type: "element";
  elements: T[];
}

interface NamedElement<Name, Children = {}[], Attributes = void | {}> {
  type: "element";
  name: Name;
  elements: Children;
  attributes: Attributes;
}

interface Root {
  elements: [
    NamedElement<
      "Function" | "Class",
      Array<Name | Declaration | USR | CommentParts>
    >
  ];
}

type Name = NamedElement<"Name", [Text]>;
type Declaration = NamedElement<"Declaration", [Text]>;
type USR = NamedElement<"USR", [Text]>;
type CommentParts = NamedElement<"CommentParts", Array<Block | Parameters>>; // TODO
type Parameters = NamedElement<"Parameters", Array<Parameter>>; // TODO
type Parameter = NamedElement<"Parameter", Array<Name | Direction | Block>>;
type Direction = NamedElement<"Direction", [Text]>;
type Block = NamedElement<
  "Abstract" | "Discussion" | "Item" | "ResultDiscussion" | "ThrowsDiscussion",
  Array<Para | CodeListing>
>;
type CodeListing = NamedElement<
  "CodeListing",
  Array<CodeLineNumbered>,
  { language?: string }
>;
type CodeLineNumbered = NamedElement<"zCodeLineNumbered", [Data]>;
type List = NamedElement<"List-Bullet" | "List-Number", Array<Block>>;
type Para = NamedElement<"Para", Array<Text | CodeVoice>>; // TODO
type CodeVoice = NamedElement<"codeVoice", [Text]>;

type SkElement =
  | Name
  | Declaration
  | USR
  | CommentParts
  | Parameters
  | Parameter
  | Direction
  | Block
  | CodeListing
  | CodeLineNumbered
  | List
  | Para
  | CodeVoice;

export function parseDocumentation(xml: string | null): string[] {
  if (xml == null) return [];
  const root = convert.xml2js(xml, {
    captureSpacesBetweenElements: true
  }) as Root;
  return root.elements.map(e =>
    e.elements
      .filter(e => e.name === SkElementType.CommentParts)
      .map(sk2md)
      .join("")
  );
}

enum SkElementType {
  cdata = "cdata",
  text = "text",
  element = "element",
  Name = "Name",
  Declaration = "Declaration",
  USR = "USR",
  CommentParts = "CommentParts",
  Parameters = "Parameters",
  Parameter = "Parameter",
  Direction = "Direction",
  Abstract = "Abstract",
  Discussion = "Discussion",
  Item = "Item",
  ResultDiscussion = "ResultDiscussion",
  ThrowsDiscussion = "ThrowsDiscussion",
  CodeListing = "CodeListing",
  zCodeLineNumbered = "zCodeLineNumbered",
  ListBullet = "List-Bullet",
  ListNumber = "List-Number",
  Para = "Para",
  codeVoice = "codeVoice"
}

function sk2md(element: SkElement | Text | Data): string {
  switch (element.type) {
    case SkElementType.cdata:
      return element.cdata;
    case SkElementType.text:
      return element.text;
    case "element":
      return skElement2md(element);
  }
}

function skElement2md(element: SkElement): string {
  const children = (
    opt: { sep?: string; map?: (v: string, i: number) => string } = {},
    els?: SkElement[]
  ) =>
    (els || (element.elements as Array<SkElement>) || [])
      .map(sk2md)
      .map(opt.map || ((id: string) => id))
      .join(opt.sep || "");
  switch (element.name) {
    case SkElementType.Abstract:
    case SkElementType.CommentParts:
      return children();
    case SkElementType.Discussion:
      return "\n\n**Discussion:**\n\n" + children() + "\n\n";
    case SkElementType.ThrowsDiscussion:
      return "\n\n**Throws:**" + children() + "\n\n";
    case SkElementType.ResultDiscussion:
      return "\n\n**Returns:**" + children() + "\n\n";
    case SkElementType.CodeListing:
      return (
        "\n```" +
        ((element as CodeListing).attributes.language || "") +
        "\n" +
        children({ sep: "\n" }) +
        "\n```\n"
      );
    case SkElementType.codeVoice:
      return "`" + children() + "`";
    case SkElementType.Declaration:
      return children();
    case SkElementType.Item:
      return children();
    case SkElementType.ListBullet:
      return "\n" + children({ sep: "\n", map: c => "* " + c }) + "\n";
    case SkElementType.ListNumber:
      return (
        "\n" + children({ sep: "\n", map: (c, i) => i + 1 + ". " + c }) + "\n"
      );
    case SkElementType.Name:
      return "**" + children() + "**";
    case SkElementType.Para:
      return "\n" + children() + "\n";
    case SkElementType.Parameter:
      const name = children(
        {},
        [].concat(
          ...element.elements
            .filter(e => e.name === SkElementType.Name)
            .map(e => e.elements)
        )
      );
      const discussion = children(
        {},
        [].concat(
          ...element.elements
            .filter(e => e.name === SkElementType.Discussion)
            .map(e => e.elements)
        )
      );
      return discussion.length > 0
        ? `**${name}:** ${discussion}`
        : `**${name}**`;
    case SkElementType.Parameters:
      return (
        "\n\n**Parameters:**" + children({ map: c => "\n* " + c }) + "\n\n"
      );
    case SkElementType.zCodeLineNumbered:
      return children();

    case SkElementType.Direction: // unknown
      return "";
    default:
      return (
        "**<" +
        element.name +
        ">** " +
        children() +
        "**<" +
        element.name +
        ">** "
      );
  }
}
