# HORIZON English funding pitch (v2): speaker notes

Main slides 1–13 are the talk (about 12 minutes at a calm pace). Appendix notes are for questions. Bracketed items are placeholders to fill before presenting. The same notes are stored in each slide of the deck.

## 01. A living laboratory on a river island.

This is Cồn Hô, a river island in Vĩnh Long province in the Mekong Delta. HORIZON is a small field-monitoring pilot that our team at the Frogsleap Foundation has built here. In the next ten minutes I want to show you the place and why local information matters there, what we have actually built and observed, and what it will take to turn this pilot into information people can rely on. I will be clear throughout about what works today and what is not yet proven.

## 02. Forecasts describe a region.

Here is the gap in one picture. Weather and river forecasts describe a cell on a grid, an area much larger than a single garden. A grower on this island decides for one plot: the water at their own intake, the soil around their own roots. The drawing is schematic. I am not claiming a particular grid size; the point is the difference in scale. HORIZON's idea is modest: put careful measurement close to where the decision is made, and keep a record of when and where every number came from.

## 03. Why Cồn Hô.

Why here? Cồn Hô is a narrow island, about a kilometre long, with river water on every side. Its orchards and gardens are never far from the bank, so the river is the water supply. In the Mekong Delta's dry season, river water can turn brackish, and growers have to judge when it is safe to take water in. That makes the island a natural place to watch water, soil and air together. It is also small and close-knit, which matters for a pilot: residents and visitors can see the equipment and, in time, use the information. The island's length comes from our own project description; the dry-season salinity is general regional context, not a HORIZON measurement.

## 04. The road to the pilot is a river.

Every part of HORIZON had to reach the island. This photograph is from our field day on 5 September 2026: the team passing a box of equipment off the boat at the river landing. It is a small moment, but it says something true about the project. The hardware is built for a place you reach by water, and keeping it working means coming back the same way.

## 05. Built and checked on the island.

This is the engineering side of the same day. Team members are wiring and checking station enclosures on the island itself, under a shelter, with the boards, batteries and radios open on the table. The station boards, the firmware and the website were made by the team. Field days like this one are where things fail and get fixed: loose connections, power, radio range. That practical experience is the main asset we bring to the next phase. [Confirm with the team: the exact tasks done on 5 Sep, and that everyone pictured has agreed to the photo being used.]

## 06. Two sensing stations. One gateway.

The physical pilot is two sensing stations and one gateway, not three sensing stations. The water station at the river measures level, conductivity, temperature and salinity. The soil station measures soil moisture, bulk conductivity, temperature and pH, plus the air temperature and humidity above it. The third node, the gateway, measures nothing itself: it receives both stations by long-range LoRa radio and forwards their messages over mobile data. The photograph shows one of our solar-powered stations installed on the island on 9 October 2026. It shows that the station is physically there; it is not evidence that it is measuring accurately. One honest caveat: the soil station has not yet stored any readings, because its battery needs replacing. The full shape here means observed in the field, the half shape means built but not yet observed working. [Confirm which station the photograph shows.]

## 07. From conditions to information.

This is the whole approach in five steps, and the shapes are honest about where each one stands. Sense: probes measure the water, the soil and the air. Connect: each station sends its readings by radio to the gateway, which forwards them over mobile data; we observe that working every few minutes. Trust: every value is stored with its time and source, and a missing value is shown as missing, never as zero. That is built, but trust also needs calibration, which we have not done yet. Understand: a public page shows the readings and states what it cannot yet tell you, for example that no threshold is validated for this site. Act: growers using validated information to make decisions. That is the goal of the next phase, not something we claim today.

## 08. One public page.

This is the real public Observatory, captured from the live site on 21 October 2026, in Vietnamese because that is the language the community uses; an English version is a click away. Salinity and water level from the water station sit at the top left, with a 24-hour chart and a map of the stations. Look at the soil panels: they say there is no data, because the soil station has not reported yet. That is deliberate. Missing data is shown as missing, never as zero. On the phone is the community report page. Anyone can pick the nearest station, describe what they saw and add a photo or short video, without an account. The report flow is built and tested in software; how many residents will use it has not been measured. I should also be candid that the chart includes long flat stretches at zero salinity; we are investigating whether those are real or a probe problem, and it is listed in the appendix.

## 09. A working pilot, observed in the field.

Here is what we can say from evidence. First, the physical pilot exists: two sensing stations and one gateway, built by the team and taken to the island; our photographs from 5 September and 9 October 2026 show the work. Second, the water station's readings reach the public record: on 21 October we counted 6,465 stored readings since 25 September, with a read-only query. Third, on recent rows, new water readings arrived roughly every two and a half minutes. These are observations of a working data chain. They are not measures of accuracy; that is the next slide. The soil station has not yet stored readings, so no soil data is counted here, and automated software test results are in the appendix rather than on this slide.

## 10. What we have not proven yet.

This slide matters as much as the last one. On a line from built, to observed, to proven, HORIZON today sits between observed and proven. Six things are not proven. Accuracy: we have not yet compared our probes with reference measurements. Thresholds: no limit is validated for this site, and the Observatory says so. Soil: the soil station has stored no readings yet because its battery needs replacing. Zero-salinity runs: in the water data there are long stretches of exactly zero; we need an administrator query and a probe check to tell a real condition from a data problem, and we will not rewrite those records. Reliability: we have no long-term uptime or maintenance record. And use: we have not measured whether people use the information or whether it changes decisions. Each of these maps to a step on the next slide.

## 11. From pilot to trusted instrument.

Here is the path from a working pilot to an instrument people can trust, in the order we would do it. Data quality first: explain the zero-salinity runs, publish the water conductivity and temperature we already collect, and restore the soil station. Then calibration: compare our readings with reference measurements on site, with agronomy and hydrology advisors reviewing the method, so that any threshold we publish is validated. Then reliability: a bench test, a supervised field soak, a maintenance routine and a public uptime record. And local ownership: trained caretakers on the island, spare parts, and an agreed long-term operator. I have left the durations blank on purpose; we will set them with partners rather than promise dates we have not planned.

## 12. What your support makes possible.

We are asking for three kinds of partner. Funding, for the unglamorous work that turns a pilot into something people can rely on: calibration, spare parts, field visits and maintenance. The amount and period are placeholders; fill them in before presenting. In return, funders receive regular progress reports and access to an open data record. Field partners, growers and cooperatives on and near the island, who will test the readings against real irrigation decisions and help shape what the information looks like. And science advisors in agronomy and hydrology, to validate our methods and any threshold before it is published, as co-authors of that work.

## 13. Help us turn readings into information people can trust.

We started with a place, and I want to end there. This is one of our stations on Cồn Hô, on the day it went up. The pilot works: readings travel from the island to a public page. What it needs now is the careful, patient work that makes those readings trustworthy and useful to the people who live here. We would like you to be part of that. Thank you. [Before presenting, replace every bracketed item with real names, figures and contact details.]

## A1. Evidence behind the main slides

Appendix. These are the facts behind the main slides, labelled by the kind of evidence. Test counts are software results from an isolated local staging environment. Stored-readings counts are live observations of the data chain. Neither is a field validation of accuracy.

## A2. Open findings from our own audit

Appendix. These are open findings from auditing our own live system. None is hidden. The zero-salinity runs need an administrator query to separate a probe condition from a data-handling cause. The firmware fix for the salinity estimate is written and compiles, but has not been flashed to any device.

## A3. Before HORIZON is called production-ready

Appendix. These are the release gates still open, and the roadmap step each belongs to.

## A4. Images used in this deck

Appendix. Every image in the deck, with its source. All photographs are real; edits are limited to cropping and a light, uniform grade.
