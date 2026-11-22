import XCTest

final class MacForecastFlowTests: XCTestCase {
    @MainActor
    func testCityForecastAndPhotoPicker() {
        continueAfterFailure = false

        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-test-city-flow", "--ui-test-reset", "--ui-test-hold-opening",
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US"
        ]
        app.launch()

        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 12))
        let skipOpening = window.buttons["opening.skip"]
        XCTAssertTrue(skipOpening.waitForExistence(timeout: 5))
        skipOpening.click()
        let search = window.textFields["location.search"]
        XCTAssertTrue(search.wait(for: \.isHittable, toEqual: true, timeout: 10))
        XCTAssertTrue(window.buttons["location.current"].exists)
        capture(window, as: "Afterglow-Mac-Location")

        search.click()
        search.typeText("San Francisco")
        let city = window.buttons.matching(identifier: "location.city-result").firstMatch
        XCTAssertTrue(city.wait(for: \.isHittable, toEqual: true, timeout: 10))
        city.click()

        XCTAssertTrue(window.staticTexts["Tonight’s sky"].waitForExistence(timeout: 12))
        XCTAssertTrue(window.sliders.firstMatch.exists)
        XCTAssertTrue(window.staticTexts["Best viewing window"].exists)
        capture(window, as: "Afterglow-Mac-Forecast")

        window.buttons["forecast.home"].click()
        XCTAssertTrue(window.staticTexts["Where will you watch?"].waitForExistence(timeout: 5))
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
