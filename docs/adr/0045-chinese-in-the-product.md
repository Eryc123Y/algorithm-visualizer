# 0045. Chinese in the product

## Status

Accepted

## Context

The site has been in Chinese since roadmap 5.7, but what it shows has not: the player's buttons and labels, the narration of every step, the labels the recipes give their structures, the words the layout draws itself ("(empty)", "top") and the names of the modules are all English. A reader of `/zh/` gets a Chinese page around an English run. Roadmap 5.8 puts the run in Chinese too, and says it "needs a decision on where a document keeps several languages".

What is to be decided:

1. Which languages, and how a reader's language is named.
2. Where a document keeps its language, or languages. The protocol is 1.0 and promises its readers that a 1.x minor version only adds (ADR 0043).
3. What is translated and what stays as it is.
4. How a recipe writes a step in two languages, so that neither falls behind.
5. How each output is asked for a language.

The text involved: about 400 narrations across the 132 modules and their structures' operations, some 40 structure labels, the section titles of structure operations, 132 titles and summaries, 14 topic headings, about 15 strings of the player's chrome and 5 words of the layout's.

## Decision

### 1. Two locales: `en` and `zh`

A **locale** is `en` (English) or `zh` (Simplified Chinese; BCP 47 `zh-Hans`). `@algomotion/spec` defines `LOCALES`, the type `Locale` and `localeOf(tag)`, which maps a BCP 47 tag to a locale: a tag whose primary subtag is `zh` is `zh`, whatever its script or region, and every other tag is `en`. A reader of Traditional Chinese gets Simplified Chinese, which they read more easily than English. The default everywhere is `en`.

The locales are not part of the protocol (they are in `spec` as the share links are, ADR 0040). A third language adds an entry to `LOCALES` and a translation of every text, nothing else.

### 2. A document is in one language

**A document holds its text in one language, and the protocol does not change: it stays 1.0.** A recipe writes its run in the locale it is asked for, and a reader who wants another language asks for another run.

The alternative was a document that keeps every language: `narration` as `{ "en": …, "zh": … }`, or a table of translations beside the steps. It was rejected:

- It is a 1.1 field that every reader must learn, for one use only: switching the language of a document already loaded without running it again. The player can already run the recipe again when it has the algorithm and its input, which is how the site and share links show runs (ADR 0032).
- Documents written by people and models are in the writer's language, and gain nothing.
- Every document a recipe writes would be about twice as long, and so would share links that carry one (`doc=`, ADR 0040), which have a limit.
- Figures, TikZ and the slides show one language at a time anyway.

The protocol keeps no field for a document's language either. Its readers do not need it: the player's chrome follows the page, not the document, and the layout's own words follow the output's locale (section 5).

### 3. What is translated

Translated:

- the narration of every step, and the titles of sections and of the document;
- the labels, notes and annotations a recipe writes in words, such as "sorted by x" or "Calls";
- each module's title and summary, and the topic headings;
- the player's chrome: its buttons' and controls' names, the frame status, "Initial state." and its error sentence;
- the words the layout draws itself: "(empty)", "top" and the queue's ends.

Kept as they are, in every locale:

- **Step names, anchors, selectors and ids** (`improve#3`, `bst.delete`). They are identifiers that notes and outputs refer to (ADR 0020), and a selector must mean the same in every language.
- **Code.** The pseudocode follows CLRS's conventions, and the book's Chinese edition keeps its pseudocode in English; Python is Python. Variable names in narration (`d[v]`, `NIL`) are code too.
- **Diagnostics.** Codes are the contract (ADR 0043); messages and hints are read by developers and by models, and stay English. The player's own sentence around an error is translated; the message inside it is not.
- **Input descriptions, MCP tool descriptions and the CLI's help**, which models and developers read.

Chinese text follows the Chinese edition of CLRS (《算法导论》) for terms it has, such as 松弛 for relax, 关键字 for key and 前驱 for predecessor, and the site's Chinese pages (roadmap 5.7) for style: full-width punctuation, and a space between Chinese and Latin letters or digits.

### 4. How a recipe writes two languages

Text a reader sees is a **`Text`**: either an object with a string for every locale, `{ en: '…', zh: '…' }`, or a plain string, which means the same in every locale and is for text without words, such as `G`, `π` or `d[v]`.

- `trace.step(anchor, text, options)` and `trace.section(id, text)` take a `Text`.
- `trace.say(text)` returns the text in the run's locale, a string, for the labels, notes and annotations a recipe passes to its structures; `trace.locale` is that locale.
- A module's definition gives `title` and `summary` as `Text`. The registry keeps `title` and `summary` as the English strings its readers use today, and adds `titleOf(module, locale)` and `summaryOf(module, locale)`, and `topicTitle(topic, locale)` beside `TOPIC_TITLES`.

Both languages of a step sit side by side in the recipe, as template literals over the same values. A narration is computed in the run (`4 + 1 = 5 < 7: C improves to 5, through B.`), so a separate catalogue keyed by step would need placeholders for every value and would drift from the code; side by side, a change to one language shows where the other must change.

A test runs every example of every module in `zh` and fails on English left in what a reader sees: every narration and section title must contain Chinese, and no label, note or annotation may contain an English word that is not code. While the modules are translated, a list of the ones still pending lets the test pass; the list is empty when 5.8 is done.

### 5. How each output is asked

| Output              | How it is asked for a locale                                                                                                                                                                                                                                                                                     | Default             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Recipes             | `runAlgorithm(id, input, { locale })`, `runModule(module, input, { locale })`                                                                                                                                                                                                                                    | `en`                |
| Layout and painters | `locale` in the layout options of `renderSvg`, `exportFigures`, `prepareFigures`, `prepareScenes` and TikZ, for the layout's own words                                                                                                                                                                           | `en`                |
| Player              | its `lang`, inherited as HTML inherits it: the element's own, or the closest ancestor's, so `<html lang="zh-Hans">` is enough. The chrome is in that locale; a run of an algorithm and its input is recorded in it; a document from `src` or inline shows its text as written. A change of `lang` runs it again. | the page's language |
| CLI                 | `--lang zh` on `run`, `render` and `export`                                                                                                                                                                                                                                                                      | `en`                |
| MCP                 | an optional `locale` argument on the tools that run a recipe or draw (`algomotion_run_recipe`, `algomotion_show`, `algomotion_render`); the guide tells models to pass the user's language                                                                                                                       | `en`                |
| Typst               | `lang:` on `algomotion` and its siblings; `auto` reads `text.lang`, so a document set in Chinese gets Chinese                                                                                                                                                                                                    | `auto`              |
| LaTeX               | the `lang` key of `\algomotionset`                                                                                                                                                                                                                                                                               | `en`                |
| Share links         | an optional `lang` key. Readers that do not know it ignore it (ADR 0040). Without it, the share page follows the reader's browser languages.                                                                                                                                                                     | the browser's       |
| Site                | `/zh/` pages are `lang="zh-Hans"`, so their players run in Chinese; the module pages and the catalogue get their `/zh/` counterparts, which 5.7 left for this item                                                                                                                                               | per page            |

### 6. In several pull requests

5.8 is too large for one pull request, and the roadmap notes the split:

1. the mechanism: locales, `Text`, the trace and registry functions, the player's chrome, the layout's words, every output's option and the share link's key, with the test and every module on the pending list;
2. the translations, a topic or two per pull request, each emptying part of the list;
3. the site's module pages and catalogue in Chinese, which closes 5.8.

## Consequences

- The protocol, its schema and every saved document stay as they are, at 1.0.
- A reader who changes language gets a new run, not a new view of the same document. For a document that is not a recipe's run, only the chrome changes.
- Every recipe's narration is written twice, side by side. A change to a recipe's narration changes both, and review sees both.
- Recipes grow by the Chinese text: a few hundred strings. The standalone CLI and the Typst plugin carry them too; `npm run sizes` measures how much.
- Chinese labels and notes in a figure are measured as wide glyphs and stay text in an outlined SVG (ADR 0024), so the figure shows them in the reader's own Chinese font. No Chinese font is bundled.
- A third language is a new locale and a translation of every `Text`; the types make every object `Text` incomplete until it has one.
- Diagnostics stay English. Translating them would make a code's message differ between readers that models and tests compare.
