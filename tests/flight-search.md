# Search Flights with dates

## Metadata

- **url**: https://guidetoiceland.is/best-flights
- **viewport**: desktop
- **tags**: search, flights, filters
- **priority**: medium

## Steps

1. Locate search widget
2. In search widget, locate "Select flights" label
3. Click flying from field, type New York, click on the field. Wait for the pop up to open and click on the 'new york, the united states' list item in a popup
   - [ ] Make sure origin set as 'New york, the united states'
4. Click flying to field, type Reykjavik, click on the field. Wait for the pop up to open and click on the 'Keflavik International' list item in a popup
   - [ ] Make sure destination set as 'Keflavik International'
5. In search widget, locate date picker with label "Select travel dates" and click on the starting date.
6. Locate a date picker pop up
   - [ ] Date picker popup is visible
7. Press next button to switch to the next month, it's a button with id '#nextMonth'
8. Choose random dates few months in advance. Never select first active date in current month, never select same date from and to.
9. Press search now button
   - [ ] Search results page is loaded
   - [ ] At least one Flight Card is visible
10. On the left top side of the page, locate Choose class "Econ..." button press it and choose Business
   - [ ] Make sure business is selected
11. Press search and validate that flights on the page are business class flights

## Expected Outcome

Search results page loads and displays Flight cards filtered by selected criteria.

## Assertions

- [ ] Dates are set in the search widget
- [ ] Search results page is displayed
- [ ] Several Flight Cards are visible
- [ ] Requested filters are applied, check filters panel to see if they are applied
- [ ] Fail the test if one of the requested filters was not applied
