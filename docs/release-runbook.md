# Release runbook

1. Refresh price data in a dedicated committed change when needed.
2. Run `npm run check` locally.
3. Push `main`; the Pages workflow builds, tests, publishes, and verifies the deployed bytes against the commit SHA.
4. Open the published site on a phone-sized viewport. Build a break, enter a bid and shipping, and confirm the values and ceiling update.

The app keeps data guidance close to the affected result: a bid ceiling appears only when product contents and price observations are complete and current.
