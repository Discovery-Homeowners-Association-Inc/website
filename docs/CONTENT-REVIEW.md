# Content the board needs to confirm

The new site's content was ported from the Hugo mockup and compared with the live Google Site
(`sites.google.com/view/discoveryhomeowners`) in September 2026. **The mockup is treated as the
more current source**, so where the two disagree the new site uses the mockup's value. All content
still needs review for accuracy by the board and others before launch. The tables below are where
to start.

## Conflicts between the live site and the mockup

| Topic                                      | Live site                                        | Mockup                                            | New site uses                                         | File                                   |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| ACC member                                 | Annette Brown                                    | Candice Swet                                      | Annette Brown                                         | `apps/site/src/data/committees.json`   |
| Candice Swet's committees                  | (not listed on ACC)                              | Architectural Control                             | Unchanged: still listed on ACC in the board roster    | `apps/site/src/data/board.json`        |
| Pool & Recreation Committee meeting place  | Sheetz, 6:30 to 7 pm                             | "Walkersville"                                    | Sheetz, Walkersville, 6:30 pm                         | `organization.json`, `committees.json` |
| Office hours, Monday, Wednesday and Friday | 9 to 1:30 (home page); 9 to 12 (facilities page) | 9 to 1:30                                         | 9 to 1:30                                             | `organization.json`                    |
| Office hours, Thursday                     | 3:30 to 6:30 pm                                  | 3:30 to 6:30 pm (an older rebuild said 5 to 8 pm) | 3:30 to 6:30 pm                                       | `organization.json`                    |
| When bins go out                           | Mon/Thu after 5 pm (ACC page)                    | Not before 6 pm the evening before                | Not before 6 pm                                       | `trash.json`                           |
| Rec Center eligibility                     | Renters allowed with landlord permission         | Residents only                                    | Renters allowed with landlord permission              | `pages.json`                           |
| Water main Phase 1 timing                  | "Scheduled to commence Spring 2025"              | "Began spring 2025", in progress                  | Mockup wording                                        | `pages.json`                           |
| Town website                               | walkersvillemd.gov                               | Mixed                                             | walkersvillemd.gov home page, not the water-bill page | `organization.json`                    |

## In the mockup but not on the live site

These have a source (a flyer or a PDF), but the live site never published them.

- **PayHOA resident portal, fees and sign-up steps.** From the association's rollout flyer.
- **RV lot fee of $50 a month or $150 a quarter from October 1, 2025.** From
  `rv-lot-policy-update-2025.pdf`.
- **Board meetings at 7:00 pm in the Recreation Center.** The live site gives the day but no time
  or place.
- Extra wording: tipping fees are "the single largest line item", parks have an "outside
  inspector", the landscaping contact, snow-route advice, and the Rec Center rules on sub-letting
  and decorations.

## On the live site but not yet on the new site

- Newsletters (Fall 2025), the 2025 Annual Meeting agenda, May 20, 2025 agenda and minutes, and
  the resale welcome package.
- Governing documents: Articles of Incorporation, Declaration, By-Laws. The documents page says
  they are coming.
- ACC Rules and Regulations and the ACC application PDF.
- Reminder notes: water-bill penalties ($100 reconnect, 2.25% card fee), help agencies, mailboxes,
  littering and pet waste, rabies.
- Recycling map, collection dates, two recycling flyers, the parks PDF, and the AARP HomeFit guide.
- Pool punch-pass prices ($5 to $60) and the rule that day passes are needed at every age.
- RV registration deadline of July 31, 2026, and the RV application PDF.
- Ice cream and food-truck nights, Community Events flyers, the Pool/Rec Google Calendar.
- Lt. Trevor Hajjar (301-600-6486); more libraries, private schools, and local media.

The PDFs live in Google Drive behind the Google Site. Someone with access needs to download them
so they can be added to the document library.

## Out of date as of September 2026

- **Pool page:** the 2026 season closed September 7. Update or hide the season details.
- **Events:** all four listed events are in the past. The home page shows only board meetings.
