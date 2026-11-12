# Evaluation contract

A candidate trained model must outperform the deterministic baseline on a test
partition separated by both time and location before it can be enabled. Report:

- CIE76 and preferably CIEDE2000 palette Delta E
- dominant color-category accuracy
- vibrancy mean absolute error
- confidence calibration error
- results by location, season, camera source, and forecast horizon

Camera exposure, white balance, HDR processing, cropping, and foreground pixels
are confounders. No production accuracy claim should be made until those effects
have been measured on a representative dataset.

