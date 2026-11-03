# HORIZON English funding pitch: speaker notes

Main slides 1-10 are the talk (about 10 minutes); appendix notes are for questions. Bracketed items are placeholders to fill before presenting.

## 1. The place

I want to start with a place, not a technology. This is Cồn Hô, a river island in Vĩnh Long, in the Mekong Delta. HORIZON is a small monitoring network we are piloting here. It measures the water around the island, the soil on it, and the air above it, and it puts those readings where people can see them. It is a pilot, and I will be plain about that. I will show you what works today, what we still have to prove, and what we are asking you to help us do next.

## 2. The gap

Here is the gap in one picture. Weather and river forecasts describe a cell on a grid, an area much larger than a single garden. A grower on this island needs to know about their own plot: the water at their intake, the soil around their roots. The grid on this illustration is schematic; I am not claiming a specific cell size. The point is only the difference in scale. Water, soil, and the data connection each change on their own clock. HORIZON's idea is modest: put careful measurement close to where the production happens, and keep a record of when and where each number came from.

## 3. The approach

The whole approach fits on four verbs. Measure: probes in the water and soil read the conditions. Send: each station sends its readings by long-range radio to a gateway, which forwards them over mobile data. Keep: every value is stored with its time and its source, so anyone can ask where a number came from. Show: a public page displays the readings, and states what it does and does not know. Residents can add their own field reports to the same record, because sensors only see what they are built to measure.

## 4. The pilot

The pilot has exactly three nodes. A water station measures level, conductivity, temperature and salinity at the river. A soil station measures moisture, conductivity, pH and temperature, plus the air above the soil. The third node is a gateway: it measures nothing itself. It receives the radio messages from the two stations and sends them over mobile data. The map is a drawing made by the project, and it is labelled as a drawing, not as satellite imagery.

## 5. The data journey

Follow one reading from the water to the screen. A probe measures the water. Our own fabricated station board reads it and prepares a short message. The station sends it by radio to the gateway, the board in this photograph. The gateway checks the message and forwards it over mobile data to the cloud database, and the public Observatory reads from there. The photograph is a bench shot of the gateway board, not an installed unit. One thing we have verified is that new readings from the water station reach the database about every two and a half minutes. That shows the chain works end to end. It does not yet show the readings are accurate; that is what calibration is for.

## 6. The Observatory

This is the public Observatory as it looked when we captured it, in Vietnamese because that is the interface the community uses. Salinity and water level from the water station are at the top left, a map of the three points sits below, and the chart covers the last twenty-four hours. Look at the soil box at the bottom left. It says there is no data. That is deliberate, and it is a rule of the product: missing data is shown as missing, never as zero. The weather cards come from an external service and are labelled that way. I will be upfront that the chart includes some long flat stretches at zero salinity. We have found them and we are investigating whether they are real or a probe reading problem. That is in the appendix. We would rather show you the real page than a polished mock-up.

## 7. The community

The sensors cover what they are built to measure. Residents see the rest: bank erosion, a stuck gate, an unusual smell. The report page is deliberately simple. No account. You choose the nearest station, say what you saw, and optionally attach a photo or a short video. If a file fails to upload, the report is still saved and marked incomplete, and the person can retry. What I can honestly say is that the flow is built and covered by automated and browser tests. What I cannot say is how many residents use it, because that has not been measured, and we have not yet confirmed large video uploads against the real production storage.

## 8. Status

This slide is the honest summary. What works: readings travel from the island to a public page, and the system labels what it knows. What we have not proven: the sensors are not calibrated against reference measurements, no threshold is validated for this site, and we have no long-term reliability record. The probe in the photograph is a bench photograph. The detailed findings from our own audit, including the open data issues, are in the appendix. A funder should know them before deciding, and we would rather tell you than have you find them.

## 9. Roadmap

Here is a realistic path, and I have left the durations blank because we should not promise dates we have not planned with partners. Harden: close the release checks we already track, such as rotating device credentials, confirming large uploads on real storage, and capturing a real network trace of the gateway link. Validate: run the bench test, then a supervised field soak, calibrate on site, and work with agronomy and hydrology reviewers so any threshold we publish is validated. Use: the same stations can then support decisions for orchards, rice and shrimp. What changes is the interpretation layer. We treat carbon measurement and verification as a goal, not a claim. And for a funder, who runs this long term and what it costs each year is still to be confirmed.

## 10. The ask

Here is what we are asking. Funding for the unglamorous work that turns a pilot into something people can rely on: calibration, validation and field maintenance. The amount and period are placeholders on the slide; fill them in before presenting. Second, field partners, growers and cooperatives who will use these readings in real decisions, because a monitoring system is only proven when someone acts on it. Third, science advisors in agronomy and hydrology to validate every threshold we publish. HORIZON will not publish a colour-coded limit until it has been validated. The photograph is the river beside Cồn Hô at dusk. Thank you. Before this deck is shown, replace every bracketed item with real names, figures and contact details.

## 11. Appendix 1: checks

Appendix. These are the verified results behind the main slides, labelled by what kind of evidence they are. Test counts are software results. The stored-readings count is a live observation. Neither is a field validation.

## 12. Appendix 2: open findings

Appendix. These are open issues we found by auditing our own live system. None is hidden. The first needs an administrator database query to separate a probe condition from a data-handling cause. We have not changed firmware or applied any database change without approval.

## 13. Appendix 3: release gates

Appendix. These are the release gates still open. They match the roadmap on slide nine.

