# Belka Tax Calculator — Known Limitations

The following are intentional scope boundaries of the Belka tax calculator, not bugs. They are tracked as potential future features.

## ✅ Implemented

### FIFO lot matching
FIFO (First In, First Out) engine for matching buy lots to sells of the same instrument. Implemented in `src/utils/fifoEngine.ts` with full per-ticker isolation, proportional fee allocation, and zero-cost (RSU/grant) support.

### Dividend tax with WHT credit
Foreign dividend income with withholding tax (WHT) and Polish top-up calculation (19% Belka minus WHT credit). Supports all treaty rates: US 15%, UK 0%, DE 26.375%, etc. WHT credit is capped at 19%.

### Solidarity levy (danina solidarnościowa)
4% surcharge on PIT-38 income exceeding 1,000,000 PLN (reported on DSF-1 form). Automatically calculated and displayed when applicable.

### PIT-38 field mapping
Summary values are mapped to official PIT-38 field positions (Poz. 24–34) based on the 2024/2025 form layout. Helps users manually fill the PIT-38 form.

## Deferred

### No loss carry-forward

Losses from prior tax years (up to 5 years, max 50% per year or 100% if the loss ≤ 1,000,000 PLN) cannot be applied. Only within-year netting across transactions is supported.

### No settlement date offset

NBP rate lookup uses the date entered by the user (typically the date from their broker confirmation). No T+1 (US equities, since May 2024) or T+2 (European equities) settlement offset is applied automatically. Users should enter the settlement date, not the trade date, for the most accurate NBP rate.
