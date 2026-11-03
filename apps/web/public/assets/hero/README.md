# Hero artwork

Empty by design — awaiting owner-supplied imagery.

`components/layout/page-hero.tsx` already exposes a `backdrop` slot that
renders behind the hero copy at z-0 (copy sits at z-10). Adding a hero image
is therefore a drop-in: put the file here and pass it as `backdrop` from the
page. No layout change is required, and the pages are designed to look
finished without one.

Naming: `home.jpg`, `about.jpg`, `monitoring.jpg`, `report.jpg`.

Do not add stock photography or generated "field" imagery here. An invented
photograph of Cồn Hô presented as this project's own would break the same
data-provenance rule the rest of the product is built around.
