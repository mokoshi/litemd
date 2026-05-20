import MarkdownIt from "markdown-it";

export const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

markdown.core.ruler.push("source_line_attrs", (state) => {
  for (const token of state.tokens) {
    if (!token.map || token.nesting === -1) {
      continue;
    }

    token.attrSet("data-source-line", String(token.map[0] + 1));
    token.attrSet("data-source-line-end", String(token.map[1]));
  }
});
