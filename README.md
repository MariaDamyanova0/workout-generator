# Workout Generator

A simple workout generator that creates quick sessions based on a selected muscle group.  
Built with vanilla JavaScript + the Wger API. Includes filtering, copy/share tools, and the ability to swap individual exercises.

## Features
- Select a **muscle group** and choose how many exercises to generate
- Optional **Bodyweight only** filter
- Uses **Wger API** to fetch exercise data
- **Swap (🔁)** any single exercise without regenerating the whole workout
- **Copy** workout to clipboard
- **Save** workouts locally (LocalStorage)
- **Download .txt** export
- **Share** (Web Share API when supported) + WhatsApp share

## Live Demo
https://mariadamyanova0.github.io/workout-generator/

## Tech Stack
- HTML, CSS, JavaScript (Vanilla)
- Wger API (exercise data)
- LocalStorage (saved workouts)

## How to Run Locally
1. Download or clone the repo
2. Open the folder in VS Code
3. Run with **Live Server** (recommended) or just open `index.html` in the browser

## Notes
- Some exercises from the API may have missing descriptions. The app handles this by showing a fallback message.
- Share options depend on your browser/device (mobile usually supports more).

## Roadmap (optional)
- Difficulty slider (beginner/intermediate/advanced)
- Timer / circuit mode
- Favorites list
