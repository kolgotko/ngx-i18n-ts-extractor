# ngx-i18n-ts-extractor
### Example
agular.json
```
{
  ...
  "projects": {
    "my-app": {
      ...
      "architect": {
        "extract-i18n-ts": {
          "builder": "@kolgotko/ngx-i18n-ts-extractor:extractor",
          "options": {
            "projectDir": "./src",
            "outputDir": "./i18n",
            "sourceLang": "ru"
          }
        },
        "xliffmerge-ts": {
          ...
        },
        ...
      }
    },
    ...
  },
  ...
}
```
