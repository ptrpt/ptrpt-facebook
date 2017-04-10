const url = require('url');
const querystring = require('querystring');
const https = require('https');

const api_hostname = 'graph.facebook.com';
const api_version_path = '/v2.8';
const api_root_url = 'https://' + api_hostname + api_version_path;
const logout_root_url = 'https://www.facebook.com/logout.php';

const oauth_authorize_hostname = 'www.facebook.com';
const oauth_authorize_path = '/dialog/oauth';
const oauth_authorize_url = 'https://' + oauth_authorize_hostname + api_version_path + oauth_authorize_path;

const oauth_access_token_path = '/oauth/access_token';

const oauth_error = 'access_denied';
const oauth_error_message = 'user_denied';
const oauth_response_type = 'code';

const get_method_str = 'GET';
const post_method_str = 'POST';

const api_publish_path = '/me/feed';
const api_current_user_path = '/me';

var apiClientId = null;
var apiClientSecret = null;
var apiClientScopes = null;
var oauthCallback = null;

// Access token (?! - Should we persist this information)
var oauthTokenData = null;

module.exports = {
    scopes: {
        publish_actions: 'publish_actions',
        public_profile: 'public_profile',
        email: 'email'
    },
    setFacebookClientOptions: function (client_id, client_secret, client_scopes, oauth_callback) {
        apiClientId = client_id;
        apiClientSecret = client_secret;
        apiClientScopes = client_scopes;
        oauthCallback = oauth_callback;
        return;
    },
    getAuthorizeUrl: function () {
        var loginUrl = url.parse(oauth_authorize_url, false);
        var query = {
            client_id: apiClientId,
            redirect_uri: oauthCallback,
            response_type: oauth_response_type,
            scope: getScopesCommaSeparated(apiClientScopes)
        };

        loginUrl.query = query;
        var redirectUrl = url.format(loginUrl);
        return redirectUrl;
    },
    getAccessToken: function (code, callback) {
        if (code) {
            var getAccessTokenUrl = url.parse(api_root_url + oauth_access_token_path, true);
            getAccessTokenUrl.query = {
                client_id: apiClientId,
                redirect_uri: oauthCallback,
                client_secret: apiClientSecret,
                code: code
            };
            var getUrl = url.format(getAccessTokenUrl);
            var get_req = https.get(getUrl, (response) => {
                var body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    var jsonData = JSON.parse(body);
                    if (jsonData.error) {
                        callback(jsonData.error);
                        return;
                    } else {
                        if (jsonData.access_token) {
                            jsonData.createdAt = Date.now();
                            oauthTokenData = jsonData;
                            callback(null, 'Logged in successfully');
                            return;
                        }
                    }
                });
            });
            get_req.on('error', (err) => {
                callback(err);
                return;
            });
            get_req.end();
        } else {
            var err = { message: 'OAuth : No code was passed back.' };
            callback(err);
            return;
        }
    },
    getLogoutUrl: function (redirectUrl) {
        if (hasTokenInfo()) {
            return getLogoutRedirectUrl(oauthTokenData.access_token, redirectUrl);
        } else {
            return null;
        }
    },
    publish: function (message, caption, link, callback) {
        // TODO - needs to refresh_token if it has expired
        if (hasTokenInfo()) {
            var jsonData = {
                access_token: oauthTokenData.access_token,
                caption: caption,
                message: message,
                link: link
            }
            var jsonStr = JSON.stringify(jsonData);

            // var parsedUrl = url.parse(graph_api_root_url + '/me/feed');

            var options = {
                host: api_hostname,
                path: api_version_path + api_publish_path,
                headers: {
                    'Content-Type': 'application/json'
                },
                method: post_method_str
            };

            var post_req = https.request(options, function (response) {
                var body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    var jsonData = JSON.parse(body);
                    if (jsonData.id) {
                        callback(null, jsonData);
                    } else {
                        callback(jsonData.error);
                        return;
                    }
                });

                response.on('error', (err) => {
                    callback(err);
                    return;
                });
            });
            post_req.write(jsonStr);
            post_req.on('error', function (err) {
                if (err) {
                    callback(err);
                    return;
                }
            });
            post_req.end();
        } else {
            callback({message: 'There is no token data available, please login first'});
            return;
        }
    },
    getCurrentUser: function (callback) {
        var data = {
            access_token: oauthTokenData.access_token,
            fields: 'id,name,gender,email'
        }
        var query = querystring.stringify(data);

        var options = {
            host: api_hostname,
            path: api_version_path + api_current_user_path + '?' + query,
            headers: {
                'Content-Type': 'application/json'
            },
            method: get_method_str
        };

        var get_req = https.request(options, function (response) {
            var body = '';
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                var jsonData = JSON.parse(body);
                if (jsonData.id) {
                    callback(null, jsonData);
                } else {
                    callback(jsonData.error);
                    return;
                }
            });

            response.on('error', (err) => {
                callback(err);
                return;
            });
        });
        get_req.on('error', function (err) {
            if (err) {
                callback(err);
                return;
            }
        });
        get_req.end();
    }

}

function getScopesCommaSeparated(scopes) {
    var resultStr = '';
    for (var key in scopes) {
        if (scopes.hasOwnProperty(key)) {
            resultStr += scopes[key] + ',';
        }
    }
    return resultStr.substring(0, resultStr.length - 1);
}
function getLogoutRedirectUrl(accessToken, nextStepUrl) {
    var baseLogoutUrl = url.parse(logout_root_url, false);
    baseLogoutUrl.query = {
        access_token: accessToken,
        next: nextStepUrl
    };

    var logoutUrl = url.format(baseLogoutUrl);
    return logoutUrl;
}

function hasTokenInfo() {
    return oauthTokenData && oauthTokenData.access_token;
}