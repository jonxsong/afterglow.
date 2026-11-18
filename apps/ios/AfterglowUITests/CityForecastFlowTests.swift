import XCTest

final class CityForecastFlowTests: XCTestCase {
    @MainActor
    func testChooseCityThenReopenTheForecastWithoutAnAccount() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--ui-test-city-flow", "--ui-test-reset"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Where will you watch?"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["location.current"].exists)
        XCTAssertFalse(XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch.exists)
        XCTAssertFalse(app.staticTexts["Tonight’s sky"].exists)
        capture("Location choice")

        let search = app.textFields["location.search"]
        XCTAssertTrue(search.exists)
        search.tap()
        search.typeText("San Francisco")
        let city = app.buttons.matching(identifier: "location.city-result").firstMatch
        XCTAssertTrue(city.waitForExistence(timeout: 10))
        city.tap()

        XCTAssertTrue(app.staticTexts["Tonight’s sky"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.sliders.firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Best viewing window"].exists)
        capture("Tonight's sky")

        let compare = app.buttons["forecast.compare"]
        if !compare.isHittable { app.swipeUp() }
        compare.tap()
        XCTAssertTrue(app.buttons["photo.choose"].waitForExistence(timeout: 10))
        capture("Photo comparison")
        app.buttons["Done"].tap()

        app.terminate()
        app.launchArguments = ["--ui-test-city-flow"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Tonight’s sky"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Skip"].exists)
        XCTAssertFalse(app.staticTexts["Where will you watch?"].exists)
    }

    @MainActor
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
