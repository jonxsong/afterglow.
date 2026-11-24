import XCTest

final class MacForecastFlowTests: XCTestCase {
    @MainActor
    func testHomeCityForecastAndPhotoPicker() {
        continueAfterFailure = false

        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-test-city-flow", "--ui-test-reset",
            "-ApplePersistenceIgnoreState", "YES",
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US"
        ]
        app.launch()

        let chooseLocation = app.buttons["home.location"]
        XCTAssertTrue(chooseLocation.wait(for: \.isHittable, toEqual: true, timeout: 15))
        let window = app.windows.firstMatch
        XCTAssertTrue(window.exists)
        XCTAssertFalse(window.buttons["home.forecast"].exists)

        chooseLocation.click()
        let search = app.textFields["location.search"]
        XCTAssertTrue(search.wait(for: \.isHittable, toEqual: true, timeout: 10))
        XCTAssertTrue(app.buttons["location.current"].exists)
        capture(window, as: "Afterglow-Mac-Location")

        search.click()
        search.typeText("San Francisco")
        let city = app.buttons.matching(identifier: "location.city-result").firstMatch
        XCTAssertTrue(city.wait(for: \.isHittable, toEqual: true, timeout: 10))
        city.click()

        XCTAssertTrue(window.staticTexts["Tonight’s sky"].waitForExistence(timeout: 12))
        XCTAssertTrue(window.sliders.firstMatch.exists)
        XCTAssertTrue(window.staticTexts["Best viewing window"].exists)
        capture(window, as: "Afterglow-Mac-Forecast")

        window.buttons["forecast.home"].click()
        XCTAssertTrue(window.staticTexts["View the golden hour"].waitForExistence(timeout: 5))
        XCTAssertTrue(window.staticTexts["home.viewingWindow"].waitForExistence(timeout: 5))
        capture(window, as: "Afterglow-Mac-Home")
        window.buttons["home.forecast"].click()
        XCTAssertTrue(window.staticTexts["Tonight’s sky"].waitForExistence(timeout: 5))

        let compare = window.buttons["forecast.compare"]
        XCTAssertTrue(compare.waitForExistence(timeout: 5))
        if !compare.isHittable {
            window.scrollViews.firstMatch.scroll(byDeltaX: 0, deltaY: -260)
        }
        XCTAssertTrue(compare.wait(for: \.isHittable, toEqual: true, timeout: 5))
        compare.click()

        let choosePhoto = app.buttons.matching(identifier: "photo.choose").firstMatch
        XCTAssertTrue(choosePhoto.wait(for: \.isHittable, toEqual: true, timeout: 8))
        capture(window, as: "Afterglow-Mac-Photo-Comparison")
        choosePhoto.click()

        // The native Open panel can be presented as a window or sheet.
        // Query through the application so either presentation is covered.
        let open = app.buttons.matching(identifier: "Open").firstMatch
        XCTAssertTrue(open.waitForExistence(timeout: 8), "The native file picker did not open.")
        // Open panels also expose a Cancel button in the Touch Bar. Escape
        // dismisses the focused panel without relying on either button's placement.
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(open.waitForNonExistence(timeout: 5))
        XCTAssertTrue(choosePhoto.wait(for: \.isHittable, toEqual: true, timeout: 5))
    }

    @MainActor
    private func capture(_ window: XCUIElement, as name: String) {
        let attachment = XCTAttachment(screenshot: window.screenshot(), quality: .original)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
