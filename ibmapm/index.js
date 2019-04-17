'use strict';
// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: ibmapm
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0
if (!global.NodeDCLoaded) {
    // The Node.js DC is not required.
    global.NodeDCLoaded = true;
} else {
    return;
}
var log4js = require('log4js');
var properties = require('properties');
var fs = require('fs');
var path = require('path');
var url = require('url');

var appmetrics = global.Appmetrics || require('appmetrics');

function isTrue(v) {
    if (v && ['false', 'False', 'FALSE', ''].indexOf(v) < 0) {
        return true;
    } else {
        return false;
    }
};

function isFalse(v) {
    return v && ['false', 'False', 'FALSE'].indexOf(v) === 0;
}

//    initialize log
if (isTrue(process.env.KNJ_LOG_TO_CONSOLE)) {
    log4js.loadAppender('console');
} else {
    log4js.loadAppender('file');
    log4js.addAppender(log4js.appenders.file('nodejs_dc.log'), 'knj_log');
}

var logger = log4js.getLogger('knj_log');
var loglevel = process.env.KNJ_LOG_LEVEL ? process.env.KNJ_LOG_LEVEL.toUpperCase() : undefined;
if (loglevel &&
    (loglevel === 'OFF' || loglevel === 'ERROR' || loglevel === 'INFO' ||
        loglevel === 'DEBUG' || loglevel === 'ALL')) {
    logger.setLevel(loglevel);
    process.env.KNJ_LOG_LEVEL = loglevel;
    logger.info('KNJ_LOG_LEVEL is set to', loglevel);
} else {
    logger.setLevel('INFO');
    // logger.info('KNJ_LOG_LEVEL is not set or not set correctly through environment variables.');
    process.env.KNJ_LOG_LEVEL = 'INFO';
    // logger.info('The program set default log level to INFO.');
}
var commontools = require('./lib/tool/common');

//    initialize log end
// Sometimes we need to change the name of some environment variables to consistant all of DC.
commontools.envDecrator();
global.DC_VERSION = getDCVersion();
//    initialize different code path - BI/BAM/Agent
var configObj;
var opentracing_sampler = process.env['opentracing.sampler'] || 1.0;
var opentracing_disabled = isFalse(process.env['opentracing.enabled']);
if (!process.env.MONITORING_SERVER_TYPE) {
    try {
        var configString = fs.readFileSync(path.join(__dirname,
            '/etc/config.properties'));

        configObj = properties.parse(configString.toString(), {
            separators: '=',
            comments: [';', '@', '#']
        });
        process.env.MONITORING_SERVER_TYPE = configObj.MONITORING_SERVER_TYPE;
    } catch (e) {
        logger.warn('Failed to read etc/config.properties');
        logger.warn('Use default MONITORING_SERVER_TYPE: BAM');
        process.env.MONITORING_SERVER_TYPE = 'BAM';
    }
}

if (!process.env.MONITORING_SERVER_URL &&
    configObj && configObj.MONITORING_SERVER_URL) {
    process.env.MONITORING_SERVER_URL = configObj.MONITORING_SERVER_URL;
}

if (!process.env.APPLICATION_NAME &&
    configObj && configObj.APPLICATION_NAME) {
    process.env.APPLICATION_NAME = configObj.APPLICATION_NAME;
}
if (!process.env.MONITORING_SECURITY_URL &&
    configObj && configObj.MONITORING_SECURITY_URL) {
    process.env.MONITORING_SECURITY_URL = configObj.MONITORING_SECURITY_URL;
}
if (!process.env.MONITORING_SERVER_NAME &&
    configObj && configObj.MONITORING_SERVER_NAME) {
    process.env.MONITORING_SERVER_NAME = configObj.MONITORING_SERVER_NAME;
}

if (process.env.MONITORING_SECURITY_URL) {
    process.env.APM_KEYFILE_URL = process.env.MONITORING_SECURITY_URL;
}

// initialize shared configurations:
if (commontools.testTrue(process.env.SECURITY_OFF)) {
    global.SECURITY_OFF = true;
}

if (typeof (process.env.KNJ_ENABLE_TT) === 'undefined' && configObj && configObj.KNJ_ENABLE_TT) {
    process.env.KNJ_ENABLE_TT = configObj.KNJ_ENABLE_TT;
}

if (typeof (process.env.KNJ_SAMPLING) === 'undefined' && configObj && configObj.KNJ_SAMPLING) {
    process.env.KNJ_SAMPLING = configObj.KNJ_SAMPLING;
}

if (typeof (process.env.KNJ_MIN_CLOCK_TRACE) === 'undefined' &&
    configObj && configObj.KNJ_MIN_CLOCK_TRACE) {
    process.env.KNJ_MIN_CLOCK_TRACE = configObj.KNJ_MIN_CLOCK_TRACE;
}

if (typeof (process.env.KNJ_MIN_CLOCK_STACK) === 'undefined' &&
    configObj && configObj.KNJ_MIN_CLOCK_STACK) {
    process.env.KNJ_MIN_CLOCK_STACK = configObj.KNJ_MIN_CLOCK_STACK;
}

if (typeof (process.env.KNJ_DISABLE_METHODTRACE) === 'undefined' &&
    configObj && configObj.KNJ_DISABLE_METHODTRACE) {
    process.env.KNJ_DISABLE_METHODTRACE = configObj.KNJ_DISABLE_METHODTRACE;
}
if (typeof (process.env.KNJ_AAR_BATCH_FREQ) === 'undefined' &&
    configObj && configObj.KNJ_AAR_BATCH_FREQ) {
    process.env.KNJ_AAR_BATCH_FREQ = configObj.KNJ_AAR_BATCH_FREQ;
}
if (typeof (process.env.KNJ_AAR_BATCH_COUNT) === 'undefined' &&
    configObj && configObj.KNJ_AAR_BATCH_COUNT) {
    process.env.KNJ_AAR_BATCH_COUNT = configObj.KNJ_AAR_BATCH_COUNT;
}
// initialize shared configurations end

// initialize BAM configuration
var bamConfObj;
if (process.env.MONITORING_SERVER_TYPE === 'BAM') {
    try {
        var bamConfString = fs.readFileSync(path.join(__dirname,
            '/etc/bam.properties'));

        bamConfObj = properties.parse(bamConfString.toString(), {
            separators: '=',
            comments: [';', '@', '#']
        });
    } catch (e) {
        logger.warn('Failed to read etc/bam.properties.');
        logger.warn('Use default BAM configuration.');
    }

    if (bamConfObj) {
        global.KNJ_AAR_BATCH_COUNT = process.env.KNJ_AAR_BATCH_COUNT ||
            bamConfObj.KNJ_AAR_BATCH_COUNT;
        global.KNJ_AAR_BATCH_FREQ = process.env.KNJ_AAR_BATCH_FREQ ||
            bamConfObj.KNJ_AAR_BATCH_FREQ;
        global.KNJ_ADR_BATCH_COUNT = process.env.KNJ_ADR_BATCH_COUNT ||
            bamConfObj.KNJ_ADR_BATCH_COUNT;
        global.KNJ_ADR_BATCH_FREQ = process.env.KNJ_ADR_BATCH_FREQ ||
            bamConfObj.KNJ_ADR_BATCH_FREQ;
    }
    global.KNJ_ADR_BATCH_COUNT = global.KNJ_ADR_BATCH_COUNT || 100;
    global.KNJ_ADR_BATCH_FREQ = global.KNJ_ADR_BATCH_FREQ || 60;

    if (process.env.KNJ_BAM_ORIGINID) {
        global.KNJ_BAM_ORIGINID = process.env.KNJ_BAM_ORIGINID;
    } else {
        global.KNJ_BAM_ORIGINID = 'defaultProvider';
    }

    if (process.env.KNJ_BAM_APPLICATION_TOPIC) {
        global.KNJ_BAM_APPLICATION_TOPIC = process.env.KNJ_BAM_APPLICATION_TOPIC;
    } else {
        global.KNJ_BAM_APPLICATION_TOPIC = 'applications';
    }
}


if (process.env.NODEJS_DC_DISABLE && process.env.NODEJS_DC_DISABLE.toLowerCase() === 'true') {
    logger.fatal('The Node.js DC is disabled. ' +
        ' Please refer to the document to configure the Node.js DC again.');
    return;
}
if (process.env.ITCAM_DC_ENABLED && process.env.ITCAM_DC_ENABLED.toLowerCase() === 'false') {
    logger.fatal('The Node.js DC is disabled. ' +
        ' Please refer to the document to configure the Node.js DC again.');
    return;
}
initJaegerSender();
commontools.enableTrace(appmetrics);

// Start DC in case rest client is ready to send payload
var restClient = require('ibmapm-restclient');
restClient.checkReadyStatus(startDC);


var DCStarted = false;

function startDC() {
    if (DCStarted) {
        logger.debug('index.js', 'DC started already!');
        return;
    }
    DCStarted = true;
    refreshJaegerSender();
    logger.debug('index.js', 'startDC()', 'start DC.');

    var plugin = require('./lib/plugin.js').monitoringPlugin;
    plugin.init('Cloudnative');

    logger.info('== Data Collector version:', global.DC_VERSION);
    logger.info('== Capabilities:');
    logger.info('   |== Metrics:', 'Enabled');
    logger.info('   |== Diagnostic:', commontools.testTrue(process.env.KNJ_ENABLE_DEEPDIVE) ? 'Enabled' : 'Disabled');
    logger.info('   |== Transaction Tracking:',
        commontools.testTrue(process.env.KNJ_ENABLE_TT) ? 'Enabled' : 'Disabled');
    logger.info('== Supported Integrations:', 'IBM Cloud Application Management,',
        'IBM Cloud Application Performance Management');

}

exports.stopDC = function() {
    appmetrics.stop();
    require('./lib/metric-manager').metricManager.stop();
};

function getDCVersion() {
    var packageJson = require(path.join(__dirname, 'package.json'));
    if (packageJson && packageJson.version) {
        return packageJson.version;
    }
    return '1.0.0';
};

function initJaegerSender() {
    logger.debug('initJaegerSender');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    if (!opentracing_disabled) {
        const zipkin = require('./appmetrics-zipkin/index.js');
        const zipkinUrl = process.env.JAEGER_ENDPOINT_ZIPKIN ?
            process.env.JAEGER_ENDPOINT_ZIPKIN : 'http://localhost:9411/api/v1/spans';
        var jaegerEndpoint = url.parse(zipkinUrl);
        logger.debug('jaeger', jaegerEndpoint.hostname, jaegerEndpoint.port, opentracing_sampler);
        var zipkinOptions;
        if (jaegerEndpoint.protocol === 'https:'){
            zipkinOptions = {
                zipkinEndpoint: zipkinUrl,
                sampleRate: opentracing_sampler,
                pfx: global.JAEGER_PFX,
                passphase: global.JAEGER_PASSPHASE
            };
            if (!zipkinOptions.pfx || !zipkinOptions.passphase) {
                process.env.JAEGER_ENDPOINT_NOTREADY = 'true';
            }
        } else {
            zipkinOptions = {
                host: jaegerEndpoint.hostname,
                port: jaegerEndpoint.port,
                sampleRate: opentracing_sampler
            };
            if (!process.env.JAEGER_ENDPOINT_ZIPKIN) {
                process.env.JAEGER_ENDPOINT_NOTREADY = 'true';
            }
        }
        zipkin(zipkinOptions);
        var internalUrls = [
            '/applicationmgmt/0.9',
            '/metric/1.0',
            '/uielement/0.8',
            '/agent_mgmt/0.6',
            'configmaps',
            '?type=providers',
            '?type=aar/middleware',
            '?type=adr/middleware',
            '/1.0/monitoring/data',
            '/OEReceiver/v1/monitoringdata/',
            '/api/v1/spans'
        ];
        zipkin.updatePathFilter(internalUrls);
        zipkin.updateHeaderFilter({
            'User-Agent': 'NodeDC'
        });

        logger.debug('initJaegerSender done', zipkinUrl, process.env.JAEGER_ENDPOINT_NOTREADY);
    }
}

function refreshJaegerSender(){
    logger.debug('refreshJaegerSender enter');
    if (!opentracing_disabled) {
        logger.debug('enter');
        const zipkin = require('./appmetrics-zipkin/index.js');
        const zipkinUrl = process.env.JAEGER_ENDPOINT_ZIPKIN ?
            process.env.JAEGER_ENDPOINT_ZIPKIN : 'http://localhost:9411/api/v1/spans';
        var jaegerEndpoint = url.parse(zipkinUrl);
        logger.debug('jaeger', jaegerEndpoint.hostname, jaegerEndpoint.port, opentracing_sampler);
        var zipkinOptions;
        if (jaegerEndpoint.protocol === 'https:'){
            zipkinOptions = {
                zipkinEndpoint: zipkinUrl,
                sampleRate: opentracing_sampler,
                pfx: global.JAEGER_PFX,
                passphase: global.JAEGER_PASSPHASE
            };
            if (zipkinOptions.pfx && zipkinOptions.passphase) {
                process.env.JAEGER_ENDPOINT_NOTREADY = 'false';
            }
        } else {
            zipkinOptions = {
                host: jaegerEndpoint.hostname,
                port: jaegerEndpoint.port,
                sampleRate: opentracing_sampler
            };
            if (process.env.JAEGER_ENDPOINT_ZIPKIN) {
                process.env.JAEGER_ENDPOINT_NOTREADY = 'false';
            }
        }
        zipkin.update(zipkinOptions);
        logger.debug('done', zipkinUrl, process.env.JAEGER_ENDPOINT_NOTREADY);
    }
};

