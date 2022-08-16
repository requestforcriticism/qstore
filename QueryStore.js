const fs = require('fs')
const sqlite = require('sqlite3')

function dlog(line, data) {
	console.log("LINE " + (line + 1) + "\t" + data)
}

class QueryStore {

	#queryFile

	#queries

	constructor(queryFile) {
		this.#queryFile = queryFile
		this.#queries = []
		this.#load(queryFile)
	}

	#load(queryFile) {
		var file = fs.readFileSync(queryFile, "utf8")


		var lines = file.split("\n")
		var unknownQueryCounter = 1 //number queries w/o names in comments
		for (var i = 0; i < lines.length; i++) {
			if (!lines[i].trim().startsWith("/*")) {
				continue
			}
			//strip * from the front
			//if no * exists then the format is broken, reject
			var currentQuery = { args: [] }
			var sqlText = ""
			while (i < lines.length) {//continue until break or file ends
				var currentLine = lines[i].trim()
				if (!currentLine.trim().length == 0 && !currentLine.startsWith("*") && !lines[i].trim().startsWith("/*") && !lines[i].trim().endsWith("*/")) {
					//file is misformed
					currentQuery.error = "BAD COMMENT AT LINE " + i

				} else {
					currentLine = currentLine.substring(1).trim()
				}

				//skip doc lines that dont contain an @ statement,
				//Otherwise every line may trigger 4 if statements
				if (currentLine.startsWith("@")) {
					if (currentLine.startsWith("@name")) {// @name <name>
						currentLine = currentLine.substring(6).trim()
						currentQuery.name = currentLine
					} else if (currentLine.startsWith("@description")) {// @description <desc>
						currentLine = currentLine.substring(12).trim()
						currentQuery.description = currentLine
					} else if (currentLine.startsWith("@parameter")) {// @parameter <name>:<type>
						currentLine = currentLine.substring(10).trim()
						currentQuery.args.push(currentLine)
					} else if (currentLine.startsWith("@returns")) {// @returns <description>
						currentLine = currentLine.substring(8).trim()
						currentQuery.returns = currentLine
					}
				}
				//if we are on last line increment i and begin copying new query
				if (lines[i].trim().endsWith("*/")) {
					i++
					for (; i < lines.length && !lines[i].trim().startsWith("/*"); i++) {
						sqlText += (lines[i] + "\n")
					}
					i--
					break
				} else {
					i++ //keep reading comment args
				}
			}
			//validate current query
			if (!currentQuery.name) {
				currentQuery.name = "unknownQuery" + unknownQueryCounter
			}
			currentQuery.sql = sqlText.trim()
			this.#queries[currentQuery.name] = currentQuery
		}
	}

	listQueries() {
		return this.#queries
	}

	getQuery(queryName) {
		return this.#queries[queryName]
	}
}


module.exports = QueryStore