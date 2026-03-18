# Search Tours Filters with dates

## Metadata

- **url**: https://guidetoiceland.is/book-trips-holiday
- **viewport**: desktop
- **tags**: search, tours, filters
- **priority**: medium

## Steps

1. Locate search widget
2. In search widget, locate date picker with label "Select dates" and click on the starting date.
3. Locate a date picker pop up
   - [ ] Date picker popup is visible
4. FILTER 1: Choose random dates, few months in advance for the 1-7 days duration.
   - [ ] Selected dates are highlighted in the date picker
5. FILTER 2: In search widget, interact with "Choose experience" input field and pick "Sightseeing"
   - [ ] "Sightseeing" is shown as selected experience in filters on the left side of the screen
6. Click Search Now button
   - [ ] Search results page is loaded
   - [ ] At least one Tour Card is visible
7. Locate filters on the left side of the page
   - [ ] Filters panel is visible on the left side
8. FILTER 3: Apply any of the Duration filters
   - [ ] Duration filter is applied
9. FILTER 4: Apply Destination filter, choose "Blue Lagoon"
   - [ ] "Blue Lagoon" destination filter is applied
10. FILTER 5: Choose Starting location in filters to be "Keflavik airport"

## Expected Outcome

Search results page loads and displays Tour card filtered by selected criteria.

## Assertions
- [ ] Dates are set in the search widget
- [ ] Search results page is displayed
- [ ] Several Tour Cards are visible
- [ ] Requested filters are applied, check filters panel to see if they are applied
- [ ] Fail the test if one of the requested filters was not applied

