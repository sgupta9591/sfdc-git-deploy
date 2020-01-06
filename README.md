# sfdc-git-deploy
A salesforce metadata deployment script with git integration

- Initiates a deployment from a local git repository
- Provides ability to fetch delta using git diff
- Generates package.xml file on the fly 

## Commands

### 1) Delta
Fetches delta using git diff command and removes unmodifed files and folders from src directory.
```sh
$ npm run delta srcpath=/unpackaged/src/ diffparam=origin/it8.2.1-fixes...it8.2-hotfix_Mon4
```
#### Parameters
| Name | Description
| ------ | ------ |
| srcpath | git src folder path |
| diffparam | git diff command first parameter |

### 2) Package
Reads files from src directory and generates a package.xml file to be used for deployment.
```sh
$ npm run package srcpath=/unpackaged/src/
```
#### Parameters
| Name | Description
| ------ | ------ |
| srcpath | salesforce metadata src folder path |

### 3) Deploy Only
Initiates a deployment (check only).
```sh
$ npm run deployonly srcpath=/unpackaged/src/ username=username@example.com password=password@123 serverurl=https://test.salesforce.com version=38.0
```
#### Parameters
| Name | Description
| ------ | ------ |
| srcpath | salesforce metadata src folder path |
| username | Salesforce account user name |
| password | Salesforce account password |
| serverurl | Salesforce login url |
| version | Salesforce API version |

### 4) Status
Displays last deployment status to console.
```sh
$ npm run status
```

### 5) Deploy
Runs delta, package and deployonly commands in sequence.
```sh
$ npm run deploy srcpath=/unpackaged/src/ username=username@example.com password=password@123 serverurl=https://test.salesforce.com diffparam=origin/it8.2.1-fixes...it8.2-hotfix_Mon4
```
#### Parameters
| Name | Description
| ------ | ------ |
| srcpath | salesforce metadata src folder path |
| username | Salesforce account user name |
| password | Salesforce account password |
| serverurl | Salesforce login url |
| diffparam | git diff command first parameter |