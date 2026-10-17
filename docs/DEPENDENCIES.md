# Dependencies and licenses

Normal runtime uses Python 3.10+ standard library, local HTML/CSS and a prebuilt
JavaScript bundle. No pip installation or network-loaded library is required.

| Package | Version | Role | License |
|---|---|---|---|
| react | 19.2.6 | Browser UI | MIT |
| react-dom | 19.2.6 | Browser rendering | MIT |
| scheduler | 0.27.0 | React runtime dependency | MIT |
| fflate | 0.8.3 | Workbook ZIP processing | MIT |
| lucide-react | 1.31.0 | Icons | ISC, plus MIT notices for Feather-derived icons |
| esbuild | 0.28.0 | Development build | MIT |
| jsdom | 30.1.2 | Development DOM tests | MIT |

Runtime notices are retained in app/THIRD-PARTY-NOTICES.txt. Direct development-tool
licenses are in DEVELOPMENT-LICENSES.txt; development dependencies are not shipped
in the runnable ZIP. Transitive dependencies remain identified in the two lockfiles
and retain their own package licenses.

Installed local versions and license files were inspected. A fresh online npm
installation and full advisory-database audit were not performed. Enable Dependency
graph and Dependabot alerts; test proposed dependency updates before releasing them.
