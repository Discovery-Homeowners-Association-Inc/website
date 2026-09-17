# Design

## Concept: the site plan

Discovery was drawn as a whole in 1972, as Frederick County's first planned community. It had
houses, parks and a pool on one plan, and its streets were named for an idea: Revelation,
Inquiry, Eureka, Imagination. The site borrows from that plan rather than from a generic
"community" template.

- **The street map is the one bold element.** It is drawn from OpenStreetMap data, and
  Discovery's own streets are picked out in plan blue. It appears on the home page and nowhere
  else.
- **Everything else is quiet.** Text is left-aligned, layouts sit on a clear grid, and there is
  no decoration that isn't carrying information.
- **The site is for residents, not visitors.** The first screen answers the questions people
  actually arrive with: when the next meeting is, when trash goes out, how to pay, who to call.

## Tokens

| Token        | Light     | Dark      | Role                                                                         |
| ------------ | --------- | --------- | ---------------------------------------------------------------------------- |
| `--paper`    | `#F4F6F5` | `#101A22` | Page ground: a cool grey-white, not cream                                    |
| `--ink`      | `#1A2530` | `#E4EAEE` | Text                                                                         |
| `--plan`     | `#1F4FA8` | `#8DB2F7` | Links, primary actions, Discovery's streets on the map                       |
| `--marigold` | `#F2B43A` | `#F2B43A` | The sun from the association mark. Used for highlight fills only, never text |
| `--pool`     | `#D6EEEA` | `#17343A` | Quiet surfaces: callouts, the "at a glance" band                             |
| `--rule`     | `#C9D2D8` | `#2A3A46` | Borders and dividers                                                         |

## Type

- **Bricolage Grotesque** (variable weight and width) for headings. It is a grotesque with
  1970s character; large headings are set heavy and slightly condensed.
- **Atkinson Hyperlegible Next** for body text. It was designed by the Braille Institute for
  low-vision readers, and many residents are older. The base size is 18px with 1.6 line
  height and a line length of at most 68ch.
- The scale is a major third (1.25). Labels are sentence case, never all caps.

## Rules we hold ourselves to

- WCAG 2.2 AA: text contrast of at least 4.5:1, a visible focus ring, and full keyboard use.
- Marigold never carries text; the ink colour sits on top of it.
- No third-party requests on public pages. Fonts are self-hosted.
- Honour `prefers-reduced-motion`. The only motion is the map drawing in once on load.
- Every page prints cleanly.
