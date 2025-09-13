/*
*
* https://github.com/jonfawcett/glooko2nightscout-bridge/blob/master/index.js#L146
* Authors:
* Jeremy Pollock
* https://github.com/jpollock
* Jon Fawcett
* and others.
*/

var qs = require('qs');
var url = require('url');

var helper = require('./convert');

_known_servers = {
  default: 'api.glooko.com'
, development: 'api.glooko.work'
, production: 'externalapi.glooko.com'
, eu: 'eu.api.glooko.com'
};

var Defaults = {
  "applicationId":"d89443d2-327c-4a6f-89e5-496bbb0317db"
, "lastGuid":"1e0c094e-1e54-4a4f-8e6a-f94484b53789" // hardcoded, random guid; no Glooko docs to explain need for param or why bad data works
, login: '/api/v2/users/sign_in'
, mime: 'application/json'
, LatestFoods: '/api/v2/foods'
, LatestInsulins: '/api/v2/insulins'
, LatestPumpBasals: '/api/v2/pumps/scheduled_basals'
, LatestPumpBolus: '/api/v2/pumps/normal_boluses'
, LatestCGMReadings: '/api/v2/cgm/readings'
, PumpSettings: '/api/v2/external/pumps/settings'
, v3API: '/api/v3/graph/data?patient=_PATIENT_&startDate=_STARTDATE_&endDate=_ENDDATE_&series[]=automaticBolus&series[]=basalBarAutomated&series[]=basalBarAutomatedMax&series[]=basalBarAutomatedSuspend&series[]=basalLabels&series[]=basalModulation&series[]=bgAbove400&series[]=bgAbove400Manual&series[]=bgHigh&series[]=bgHighManual&series[]=bgLow&series[]=bgLowManual&series[]=bgNormal&series[]=bgNormalManual&series[]=bgTargets&series[]=carbNonManual&series[]=cgmCalibrationHigh&series[]=cgmCalibrationLow&series[]=cgmCalibrationNormal&series[]=cgmHigh&series[]=cgmLow&series[]=cgmNormal&series[]=deliveredBolus&series[]=deliveredBolus&series[]=extendedBolusStep&series[]=extendedBolusStep&series[]=gkCarb&series[]=gkInsulin&series[]=gkInsulin&series[]=gkInsulinBasal&series[]=gkInsulinBolus&series[]=gkInsulinOther&series[]=gkInsulinPremixed&series[]=injectionBolus&series[]=injectionBolus&series[]=interruptedBolus&series[]=interruptedBolus&series[]=lgsPlgs&series[]=overrideAboveBolus&series[]=overrideAboveBolus&series[]=overrideBelowBolus&series[]=overrideBelowBolus&series[]=pumpAdvisoryAlert&series[]=pumpAlarm&series[]=pumpBasaliqAutomaticMode&series[]=pumpBasaliqManualMode&series[]=pumpCamapsAutomaticMode&series[]=pumpCamapsBluetoothTurnedOffMode&series[]=pumpCamapsBoostMode&series[]=pumpCamapsDailyTotalInsulinExceededMode&series[]=pumpCamapsDepoweredMode&series[]=pumpCamapsEaseOffMode&series[]=pumpCamapsExtendedBolusNotAllowedMode&series[]=pumpCamapsManualMode&series[]=pumpCamapsNoCgmMode&series[]=pumpCamapsNoPumpConnectivityMode&series[]=pumpCamapsPumpDeliverySuspendedMode&series[]=pumpCamapsUnableToProceedMode&series[]=pumpControliqAutomaticMode&series[]=pumpControliqExerciseMode&series[]=pumpControliqManualMode&series[]=pumpControliqSleepMode&series[]=pumpGenericAutomaticMode&series[]=pumpGenericManualMode&series[]=pumpOp5AutomaticMode&series[]=pumpOp5HypoprotectMode&series[]=pumpOp5LimitedMode&series[]=pumpOp5ManualMode&series[]=reservoirChange&series[]=scheduledBasal&series[]=setSiteChange&series[]=suggestedBolus&series[]=suggestedBolus&series[]=suspendBasal&series[]=temporaryBasal&series[]=unusedScheduledBasal&locale=en-GB'
// ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
};

function base_for (spec) {
  var server = spec.glookoServer ? spec.glookoServer : _known_servers[spec.glookoEnv || 'default' ];
  var base = {
    protocol: 'https',
    host: server
  };
  return url.format(base);
}

function login_payload (opts) {
  var body = {
    "userLogin": {
      "email": opts.glookoEmail,
      "password": opts.glookoPassword
    },
    "deviceInformation": {
      "deviceModel": "iPhone"
    }
  };
  return body;
}
function glookoSource (opts, axios) {
  var default_headers = { 'Content-Type': Defaults.mime,
                          'Accept': 'application/json, text/plain, */*',
                          'Accept-Encoding': 'gzip, deflate, br',
                          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
                          'Referer': 'https://eu.my.glooko.com/',
                          'Origin': 'https://eu.my.glooko.com',
                          'Connection': 'keep-alive',
                          'Accept-Language': 'en-GB,en;q=0.9'
                          };
  var baseURL = opts.baseURL;
  //console.log('GLOOKO OPTS', opts);
  var http = axios.create({ baseURL, headers: default_headers });
  function constructUrl(endpoint, session, startDate, endDate) {
    //?patient=orange-waywood-8651&startDate=2020-01-08T06:07:00.000Z&endDate=2020-01-09T06:07:00.000Z
    const urlStr = endpoint + "?patient=" + session.user.userLogin.glookoCode
      + "&startDate=" + startDate.toISOString()
      + "&endDate=" + endDate.toISOString();
    return urlStr;
  }

  function fetcher(endpoint, session, params) {
    var headers = { ...default_headers };
    headers["Cookie"] = session.cookies;
    headers["Host"] = "eu.api.glooko.com";
    headers["Sec-Fetch-Dest"] = "empty";
    headers["Sec-Fetch-Mode"] = "cors";
    headers["Sec-Fetch-Site"] = "same-site";
    console.log('GLOOKO FETCHER LOADING', endpoint, { params });
    return http.get(endpoint, { headers, params })
      .then((resp) => resp.data)
      .catch((err) => {
        console.error("GLOOKO FETCH ERROR", endpoint, err.response ? err.response.data : err);
        throw err;
      });
  }

  var impl = {
    authFromCredentials() {
      var payload = login_payload(opts);
      return http.post(Defaults.login, payload)
        .then((response) => {
          console.log("GLOOKO AUTH SUCCESS", response.headers, response.data);
          return { cookies: response.headers['set-cookie'][0], user: response.data };
        })
        .catch((err) => {
          console.error("GLOOKO AUTH ERROR", err.response ? err.response.data : err);
          throw err;
        });
    },
    sessionFromAuth(auth) {
      return Promise.resolve(auth);
    },
    dataFromSesssion(session, last_known) {
      // Always fetch the last 24 hours of data, regardless of bookmark
      const HISTORICAL_WINDOW_HOURS = 24;
      var now = new Date();
      var windowStart = new Date(now.getTime() - (HISTORICAL_WINDOW_HOURS * 60 * 60 * 1000));
      var maxCount = Math.ceil((now.getTime() - windowStart.getTime()) / (1000 * 60 * 2)); // 2 min interval
      var lastUpdatedAt = windowStart.toISOString();
      var params = {
        lastGuid: Defaults.lastGuid,
        lastUpdatedAt,
        limit: maxCount,
      };
      const startDate = windowStart;
      const endDate = now;
      return Promise.all([
        fetcher(constructUrl(Defaults.LatestPumpBasals, session, startDate, endDate), session, params),
        fetcher(constructUrl(Defaults.LatestPumpBolus, session, startDate, endDate), session, params),
        fetcher(constructUrl(Defaults.LatestCGMReadings, session, startDate, endDate), session, params),
        //fetcher(constructUrl(Defaults.PumpSettings, session, startDate, endDate), session, params)
      ]).then(function (results) {
        var some = {
          scheduledBasals: results[0].scheduledBasals,
          normalBoluses: results[1].normalBoluses,
          readings: results[2].readings
        };
        return some;
      });
    },
    align_to_glucose() {
      // TODO
    },
    transformData(batch) {
      // TODO
      console.log('GLOOKO passing batch for transforming');
      var treatments = helper.generate_nightscout_treatments(batch, opts.glookoTimezoneOffset);
      return { entries: [], treatments: treatments };
    }
  };
  function tracker_for ( ) {
    // var { AxiosHarTracker } = require('axios-har-tracker');
    // var tracker = new AxiosHarTracker(http);
    var AxiosTracer = require('../../trace-axios');
    var tracker = AxiosTracer(http);
    return tracker;
  }
  function generate_driver (builder) {
    builder.support_session({
      authenticate: impl.authFromCredentials,
      authorize: impl.sessionFromAuth,
      // refresh: impl.refreshSession,
      delays: {
        REFRESH_AFTER_SESSSION_DELAY: (1000 * 60 * 60 * 24 * 1) - 600000,
        EXPIRE_SESSION_DELAY: 1000 * 60 * 60 * 24 * 1,
      }
    });

    builder.register_loop('Glooko', {
      tracker: tracker_for,
      frame: {
        impl: impl.dataFromSesssion,
        align_schedule: impl.align_to_glucose,
        transform: impl.transformData,
        backoff: {
          // wait 1 minute * 2^attempt
          interval_ms: 1 * 60 * 1000
        },
        // only try 3 times to get data
        maxRetries: 3
      },
      // expect new data 2 minutes after last success
      expected_data_interval_ms: 2 * 60 * 1000,
      backoff: {
        // wait 1 minute * 2^attempt
        interval_ms: 1 * 60 * 1000
      },
    });
    return builder;
  }
  impl.generate_driver = generate_driver;
  return impl;
}

glookoSource.validate = function validate_inputs (input) {
  var ok = false;
  var baseURL = base_for(input);

  const offset = !isNaN(input.glookoTimezoneOffset) ? input.glookoTimezoneOffset * -60 * 60 * 1000 : 0
  console.log('GLOOKO using ms offset:', offset, input.glookoTimezoneOffset);

  var config = {
    glookoEnv: input.glookoEnv,
    glookoServer: input.glookoServer,
    glookoEmail: input.glookoEmail,
    glookoPassword: input.glookoPassword,
    glookoTimezoneOffset: offset,
    baseURL
  };
  var errors = [ ];
  if (!config.glookoEmail) {
    errors.push({desc: "The Glooko User Login Email is required.. CONNECT_GLOOKO_EMAIL must be an email belonging to an active Glooko User to log in.", err: new Error('CONNECT_GLOOKO_EMAIL') } );
  }
  if (!config.glookoPassword) {
    errors.push({desc: "Glooko User Login Password is required. CONNECT_GLOOKO_PASSWORD must be the password for the Glooko User Login.", err: new Error('CONNECT_GLOOKO_PASSWORD') } );
  }
  ok = errors.length == 0;
  config.kind = ok ? 'glooko' : 'disabled';
  return { ok, errors, config };
}
module.exports = glookoSource;
