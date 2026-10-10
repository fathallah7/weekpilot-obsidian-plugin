# WeekPilot OS for Obsidian

WeekPilot is a vault-native weekly operating system. It connects weekly outcomes, projects, execution, month maps, and reflection without forcing a daily schedule.

## Features

- Define up to three meaningful outcomes for each week.
- Run actions through Now, Next, and Done execution lanes.
- Link outcomes and actions to projects and life/work areas.
- See automatic project progress across all weeks.
- Generate a strategic month map with weekly load signals.
- Review wins, friction, lessons, and unresolved decisions.
- Move or drop carry-over work intentionally instead of rolling it forward automatically.
- Enter Focus Mode for a distraction-free current week.
- Track momentum from outcomes and completed actions.
- Follow the active Obsidian theme automatically.
- Store every week as a readable Markdown file inside the vault.

## Install manually

1. Extract the `weekpilot` folder into `<your-vault>/.obsidian/plugins/`.
2. In Obsidian, open **Settings → Community plugins**.
3. Reload plugins, then enable **WeekPilot**.
4. Click the calendar-check icon in the left ribbon.

The installable build requires `manifest.json`, `main.js`, and `styles.css`. Source files are included for development.

## Develop

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run typecheck
npm run build
```

## Data

Weekly files are saved to `WeekPilot/Weeks` and project data to `WeekPilot/system.json`. Existing v0.1 tasks are migrated in place the first time their week is saved. All data remains inside the vault.

## License

WeekPilot is available under the [MIT License](LICENSE).
