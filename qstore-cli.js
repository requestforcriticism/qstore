#! /usr/bin/env node
const { Command } = require('commander')
const sqlite3 = require('sqlite3')
const fs = require('fs')
const { parse } = require('csv-parse')

const QueryStore = require('./QueryStore')

const qstore = new Command()

qstore
	.name('qstore')
	.description('A CLI tool to intract with Query Store files')
	.version('0.0.0')

qstore.command('list')
	.description('View the defined queries in a Query Store file')
	.argument("<file>", "Path of a Query Store file to search")
	.option("--json", "Display raw json output")
	.action((file, options) => {
		if (!fs.existsSync(file)) {
			console.log("File " + file + " not found.")
			process.exit(1)
			return
		}
		var qs = new QueryStore(file)
		if (options.json) {
			console.log(qs.listQueries())
		} else {
			var queries = qs.listQueries()
			for (var q in queries) {
				console.log(queries[q].name)
			}
		}
	})

qstore.command('execute')
	.description('Execute a query defined in a Query Store file')
	.argument("<file>", "Path to the SQLite3 database file")
	.argument("<file>", "Path to the Query Store file")
	.argument("<string>", "Name of the query to be executed")
	.argument("[string...]", "Perameters to use in the selected query")
	.option("-g, --get", "Override query return to get first affected row")
	.option("-a, --all", "Override query return to get all affected row")
	.option("-c, --changes", "Override query return to display count of affected rows")
	.action((dbFile, qsFile, queryName, params, options) => {
		if (!fs.existsSync(qsFile)) {
			console.log("File " + qsFile + " not found.")
			process.exit(1)
			return
		}
		var qs = new QueryStore(qsFile)
		if (!qs.getQuery(queryName)) {
			console.log("Query " + queryName + " does not exist within " + qsFile + ".")
			process.exit(1)
			return
		}

		if (params.length != qs.getQuery(queryName).args.length) {
			console.log("Query " + queryName + " expects " + qs.getQuery(queryName).args.length + " arguments.")
			console.log(params.length + " arguments were provided.")
			process.exit(1)
			return
		}

		db = new sqlite3.Database(dbFile)
		db.serialize(() => {
			if (options.get) {
				db.get(qs.getQuery(queryName).sql, params, (err, rows) => {
					console.table(rows)
				})
			} else if (options.all) {
				db.all(qs.getQuery(queryName).sql, params, (err, rows) => {
					console.table(rows)
				})
			} else if (options.changes) {
				db.all(qs.getQuery(queryName).sql, params, (err, rows) => {
					console.log(rows.length + " rows affected.")
				})
			} else {
				db.all(qs.getQuery(queryName).sql, params, (err, rows) => {
					console.table(rows)
				})
			}


		})
		db.close()
	})

qstore.command("batch")
	.description("Execute multiple simmilar queries with input from a .csv file")
	.argument("<file>", "Path to the SQLite3 database file")
	.argument("<file>", "Path to the Query Store file")
	.argument("<string>", "Name of the query to be executed")
	.argument("<file>", "Path to the csv file containing data")
	//.option("--skip-header", "skip the first line header")
	.action((dbFile, qsFile, queryName, csvFile, options) => {
		if (!fs.existsSync(qsFile)) {
			console.log("File " + qsFile + " not found.")
			process.exit(1)
			return
		}
		if (!fs.existsSync(csvFile)) {
			console.log("File " + csvFile + " not found.")
			process.exit(1)
			return
		}
		var qs = new QueryStore(qsFile)
		if (!qs.getQuery(queryName)) {
			console.log("Query " + queryName + " does not exist within " + qsFile + ".")
			process.exit(1)
			return
		}

		db = new sqlite3.Database(dbFile)
		var addedRecords = 0
		const parser = parse();
		parser.on('readable', function () {
			//do db write with input arr
			
			var record = parser.read()
			
			if (record.length != qs.getQuery(queryName).args.length) {
				console.log("Query " + queryName + " expects " + qs.getQuery(queryName).args.length + " arguments.")
				console.log(record.length + " arguments were provided.")
				console.log("Bad record was " + record)
				console.log("Continuing with next record.")
				return
			}
			
			db.all(qs.getQuery(queryName).sql, record, (err, rows) => {
				addedRecords++
			})
		});
		// Catch any error
		parser.on('error', function (err) {
			console.error(err.message);
		});
		// Test that the parsed records matched the expected records
		parser.on('end', function () {
			db.close()
			console.log("Executed " + addedRecords + " statements")
		});
		
		fs.createReadStream(csvFile).pipe(parser)

	})


qstore.parse()

