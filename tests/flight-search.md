# Search Flights with dates

## Metadata

- **url**: https://guidetoiceland.is/best-flights
- **viewport**: desktop
- **tags**: search, flights, filters
- **priority**: medium

## Steps

1. Locate search widget
2. In search widget, locate "Select flights" label
3. Click flying from field, type New York, click on the field. Wait for the pop up to open and click on the list item in a popup
   - [ ] Make sure origin set as NY 
4. Click flying to field, type Reykjavik,click on the field. Wait for the pop up to open and click on the list item in a popup
   - [ ] Make sure destination set as Reykjavik 
5. In search widget, locate date picker with label "Select travel dates" and click on the starting date.
6. Locate a date picker pop up
   - [ ]  Date picker popup is visible
7. Choose randon dates few months in advance
8. Press search now button
   - [ ]  Search results page is loaded
   - [ ]  At least one Flight Card is visible
9. On the left top side of the page, locate Choose class "Econ..." button press it and choose Business
   - [ ] Make sure business is selected
10. Press search and validate that flights on the page are business class flights



## Expected Outcome

Search results page loads and displays Flight cards filtered by selected criteria.

## Assertions

- [ ]  Dates are set in the search widget
- [ ]  Search results page is displayed
- [ ]  Several Flight Cards are visible
- [ ]  Requested filters are applied, check filters panel to see if they are applied
- [ ]  Fail the test if one of the requested filters was not applied
