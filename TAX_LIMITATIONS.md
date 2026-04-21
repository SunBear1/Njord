# Belka Tax Calculator — Known Limitations

The following are intentional scope boundaries of the Belka tax calculator, not bugs. They are tracked as potential future features.

## No FIFO matching

Polish tax law requires FIFO (First In, First Out) for matching buy lots to sells of the same instrument. The calculator currently treats each transaction independently — users must pre-compute cost basis per lot before entering transactions.

## No loss carry-forward

Losses from prior tax years (up to 5 years, max 50% per year or 100% if the loss ≤ 1,000,000 PLN) cannot be applied. Only within-year netting across transactions is supported.

## No dividend tax handling

Foreign dividends with withholding tax (WHT) and the Polish top-up (19% minus WHT credit) are not supported. Common treaty rates: US 15% (with W-8BEN), Germany 26.375%, UK 0%.

## No solidarity levy

The 4% surcharge on PIT-38 income exceeding 1,000,000 PLN (reported on DSF-1 form) is not computed. This affects only very high-value portfolios.

## No settlement date offset

NBP rate lookup uses the date entered by the user (typically the date from their broker confirmation). No T+1 (US equities, since May 2024) or T+2 (European equities) settlement offset is applied automatically. Users should enter the settlement date, not the trade date, for the most accurate NBP rate.

## No PIT-38 form field mapping

The summary shows totals (revenue, costs, income/loss, tax) but does not map values to specific Poz. (field) numbers on the official PIT-38 form. Users must manually transfer values to the appropriate fields.
