/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0
 
 DEPENDENCIES:
		native-dns v0.7.0 (https://www.npmjs.com/package/native-dns)

 DESCRIPTION: Monitor DNS utilization

 SYNTAX: node dns_monitor.js <HOST> <METRIC_STATE> <CIR_IDS> <PARAMS>
 
 EXAMPLE: node dns_monitor.js "192.168.69.3" "1,1" "2781" "new;gmail.com#new#MX#"

 README:
		<HOST> hostname or ip address to dns server.
		
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off

		<CIR_IDS> is generated internally by Tellki and its only used by Tellki default monitors

		<PARAMS> are 4 fields separeted by "#" and it contains the monitor's configuration, is generated internally
		by Tellki and it's only used by Tellki's default monitors.
*/


// METRICS IDS
var statusId = "165:Status:9";
var responseTimeId = "124:Response Time:4";


// ############# INPUT ###################################

//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{	
	if(args.length != 4)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}

/*
* Process the passed arguments and send them to monitor execution (monitorDNS)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	// <HOST> 
	var dnsServer = args[0];
	
	// <METRIC_STATE> 
	var metricState = args[1];
	
	var tokens = metricState.split(",");

	// metric Status state
	var checkStatus = false;
	// metric Response time state
	var checkTimeout = false;
	
	if (tokens[0] == "1")
	{
		checkStatus = true;
	}

	if (tokens[1] == "1")
	{
		checkTimeout = true;
	}
	
	
	// <CIR_IDS> 
	var cirUUDIS = args[2].split(",");
	
	// <PARAMS>
	var dnsTestsRepresentation = args[3].split(",");
	
	//create dns tests
	var dnsQueryRequests = [];

	var i = 0;
	for (var j in dnsTestsRepresentation)
	{
		var tokens = dnsTestsRepresentation[j].split("#", 4);
		
		var dnsTestRepresentation = new Object();
		dnsTestRepresentation.dnsServer = dnsServer
		dnsTestRepresentation.cirUUDI = cirUUDIS[i];
		dnsTestRepresentation.record = tokens[2];
		dnsTestRepresentation.host = tokens[0].split(";")[1];
		dnsTestRepresentation.ipMatch = tokens[3];
		dnsTestRepresentation.checkStatus = checkStatus;
		dnsTestRepresentation.checkTimeout = checkTimeout;
		
		dnsQueryRequests.push(dnsTestRepresentation);

		i++;
	}
	
	//call monitor
	monitorDNS(dnsQueryRequests);
	
}



// ################# DNS CHECK ###########################
/*
* Tests executer
* Receive: Test's list
*/
function monitorDNS(dnsQueryRequests) 
{
	for(var i in dnsQueryRequests)
	{
		//start time to measure response time
		var start = Date.now();
		
		var dnsRequest = dnsQueryRequests[i];
		
		dns(dnsRequest, start)
	}
}

/*
* Retrieve metrics information
* Receive: object test
*/
function dns(dnsRequest, start)
{
	var dns = require('native-dns');
	
	var message = "";
	
	//create dns question
	var question = dns.Question({
		name: dnsRequest.host,
		type: dnsRequest.record,
	});

	//create dns request
	var req = dns.Request({
		question: question,
		server: { address: dnsRequest.dnsServer},
	});

	//on request timeout error
	req.on('timeout', function () {
		// output metric status set to 0
		processMetricOnError(dnsRequest, start)
	});
	
	//response data
	req.on('message', function (err, response) {
		
		if(response.answer.length > 0)
		{
			var result = 0;
			
			//compare with ip in configuration if not empty
			if(dnsRequest.ipMatch === "")
			{
				result = 1;
			}
			else
			{
				for (var i in response.answer) 
				{

					if (response.answer[i].address === dnsRequest.ipMatch) 
					{
						result = 1;
						break;
					}
				}
			}
			
			
			if(result === 0)
			{
				// output metric status set to 0
				processMetricOnError(dnsRequest, start);
			}
			else
			{
				// output metrics
				processMetricOnSuccess(dnsRequest, start);
			}
		}
		else
		{
			// output metric status set to 0
			processMetricOnError(dnsRequest, start);
		}
	});

	
	
	req.on('error', function(err){
		// output metric status set to 0
		processMetricOnError(dnsRequest, start);
		
	});

	req.send();
	
}


//################### OUTPUT METRICS ###########################

/*
* Send metrics to console
* Receive: metrics list to output and target id (cir_id representing the dns test)
*/
function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += targetId;
		out += "|";
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		out += metric.obj
		out += "|";
		
		console.log(out);
	}
}

/*
* process metrics on error
* Receive: 
* - object request to output info
* - start time, to calculate execution time and response time
*/
function processMetricOnError(request, start)
{	
	if(request.checkStatus)
	{
		var metrics = [];
		
		var metric = new Object();
		metric.id = statusId;
		metric.val = 0;
		metric.ts = start;
		metric.exec = Date.now() - start;
		metric.obj = request.host

		metrics.push(metric);

		output(metrics, request.cirUUDI);
	}
}

/*
* process metrics on success
* Receive: 
* - object request to output info
* - start time, to calculate execution time and response time
*/
function processMetricOnSuccess(request, start)
{
	var metrics = [];
	
	if(request.checkStatus)
	{
		var metric = new Object();
		metric.id = statusId;
		metric.val = 1;
		metric.ts = start;
		metric.exec = Date.now() - start;
		metric.obj = request.host

		metrics.push(metric);
	}
	
	if(request.checkTimeout)
	{
		var metric = new Object();
		metric.id = responseTimeId;
		metric.val = Date.now() - start;
		metric.ts = start;
		metric.exec = Date.now() - start;
		metric.obj = request.host

		metrics.push(metric);
	}
	
	output(metrics, request.cirUUDI);
}



//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;
