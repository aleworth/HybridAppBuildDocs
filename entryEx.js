var MxApp = require("@mendix/mendix-hybrid-app-base");

MxApp.onConfigReady(function(config) {
    config.server.timeout = 30 * 1000; // 30 seconds
    // const promise = new Promise((resolve, reject) => {
    //     const samlLogin = cordova.plugins.browser.open(window.mx.remoteUrl + "xsuaalogin/?cont=rest/mobile/v1/secret")
    // })
    function samlLogin() {
        
        console.log('LOGIN: Instantiating samlWindow');
        var browser = cordova.plugins.browser; //This browser is important because it's essentially a Custom Tabs window, which is separate from cordova's standard in app browser because it actually gives you access to the secrets in Chrome. We need this to allow for seamless SSO
        browser.open(window.mx.remoteUrl + "xsauaalogin/?cont=rest/mobile/v1/secret");
        
    };

    //This bit of code integrates with the NativeLogin module - its main purpose is to use the secret returned from the redirect after authentication through uaa to call a separate service that returns a valid token. That token is then stored on the device and the app is reloaded so that new stored token takes effect
    function fetchToken(secret, url) {
        var authReq = new XMLHttpRequest();
        authReq.open("GET", url, true);
        authReq.setRequestHeader('secret', secret);
        authReq.onreadystatechange = () => {
            if(authReq.readyState === authReq.DONE) {
                if(authReq.status === 200) {
                    console.log('TOKEN STATUS: ' + authReq.status);
                    console.log('TOKEN RESPONSE: ' + authReq.response);
                    var jsonResponse;

                    if(authReq.response !== undefined && authReq.response !== null) {
                        jsonResponse = JSON.parse(authReq.response);
                        console.log('TOKEN: ' + jsonResponse.token);
                        
                        //We store the token and reload the app if we get a valid response. The app reload is necessary to account for the new token being saved
                        mx.session.tokenStore.set(jsonResponse.token).then((result) => {
                            window.mx.reload();
                        });
                        //setTimeout(function(){ window.mx.reload(); }, 75);
                        //setTimeout(function(){ handlePendingDeeplink(pendingLink); }, 105);
                    }
                    else {
                        console.log('TOKEN LOGIN ISSUE: RESPONSE IS COMPLETE CRAP\n');
                    }
                }
                else {
                    console.log('TOKEN LOGIN ISSUE: There was an issue during the login process');
                    console.log('TOKEN LOGIN ISSUE: STATUS - ' + authReq.status + ' - ' + authReq.responseText);
                }
            }  
        };

        authReq.send();
    };

    //This bit overrides the standard login process with the samlLogin function defined above
    config.ui.customLoginFn = samlLogin;

    //This is a dojo function that handles incoming url calls
    window.handleOpenURL = function(url) {

        /*if(window.mx && window.mx.session.isGuest()) {
            window.pendingDeeplink = url;
        }
        else if (!window.mx) {
            window.pendingDeeplink = url;
        }
        else {
            window.handlePendingDeeplink(url);
        }*/

        //If the mendix client exists, is loaded, and the session is not tied to a guest then we just jump straight into handling the incoming link
        if(window.mx && window.mx.isLoaded() && !window.mx.session.isGuest()) {
            console.log("LOGIN: Moving to handle pending deeplink");
            window.handlePendingDeeplink(url);
        } //If the link includes 'secret' and we are still in a guest session we go to the fetchToken function defined above
        else if (url.includes('secret')) {
            var decodedUrl = decodeURIComponent(escape(url));
            console.log("LOGIN: Handling secret deeplink with " + decodedUrl);
            var newUrlArray = url.split('://');
            var secretArray = newUrlArray[1].split('/');
            var secret = secretArray[1];
            var loginUrl = window.mx.remoteUrl + "rest/mobile/v1/token";
            console.log('OPEN URL: Secret-' + secret + '\nService URL: ' + loginUrl);
            console.log('OPEN URL: Deep Link URL = ' + window.pendingDeeplink);
            fetchToken(secret, loginUrl);
        }//If we don't meet the above criteria we add an on load action (Dojo) to the window and end incoming url handling. We'll always hit this on first opening the app while the login process is simultaneously executing
        else {
            console.log('Creating on load with following URL: ' + url);
            window.pendingDeeplink = url;
            window.mx.addOnLoad(function(){
                window.handlePendingDeeplink(window.pendingDeeplink);
                console.log('ON LOAD: Executing onload with ' + window.pendingDeeplink);
                window.pendingDeeplink = '';
            });
        }
    }

    //Need to make url = to https:// in the front instead of custom url (womaintenance://)
    //This bit of code integrates with the 'DeepLink' module in the apps. It calls a PUT service (Custom) in that module to add a new url to the stack to be handled as an incoming deeplink
    window.handlePendingDeeplink = function(url) {
        console.log('Did launch application from the link: ' + url);
            var oReq = new XMLHttpRequest();
            /* use a PUT to get responses from DL without redirects
             * 200 means it's ready
             * 401 means you're not logged in
             * 404 means not found
             */
            var newUrlArray = url.split('://');
            var newURL = "https://" + newUrlArray[1];
            console.log('Old URL: ' + url + '; New URL: ' + newURL);

            oReq.open("put", newURL, true);
            //detect if iOS for handle deeplink
            console.log('Device platform: ' + device.platform);
            if (device.platform === 'iOS' || device.platform === 'Android') {
                //var pid = window.mx.ui.showProgress("Loading link...");
                oReq.onreadystatechange = () => {
                    if(oReq.readyState === oReq.DONE) {
                        if(oReq.status === 200) {
                            console.log("Entry.js - Deeplink portion - Request made it to server with 200");
                            //window.mx.ui.hideProgress(0);
                            window.mx.data.action({
                                params: {
                                    actionname: "WorkOrder.ACT_ShowHomePage_DeepLink"
                                },
                                origin: window.mx.ui.getContentForm(),
                                callback: function() {
                                    //window.mx.ui.hideProgress(pid);
                                },
                                error: function(error) {
                                    //window.mx.ui.hideProgress(pid);
                                    window.mx.ui.error("Unable to load link. Please try again.");
                                }
                            });
                        } else if (oReq.status === 401) {
                            console.log("Entry.js - Deeplink portion - Request made it to server with 401");
                            //we weren't redirected (got a 200) and instead were sent to a login page. Show an error
                            //window.mx.ui.hideProgress(pid);
                            window.mx.ui.error("Sorry, you need to be logged in to view this link. Please log in and try again");
                        } else {
                            console.log("Entry.js - Deeplink portion - Something went wrong");
                            //something else went wrong
                            //window.mx.ui.hideProgress(pid);
                            window.mx.ui.error("Sorry, something went wrong with the link.");
                        }
                    }
                };
            }
        oReq.send();
    }
});

MxApp.onClientReady(function(mx) {

    var originalAfterLogin = mx.afterLoginAction;
    window.mx.afterLoginAction = function() {
        originalAfterLogin();
    }
});

// Uncomment this function if you would like to control when app updates are performed
/*
MxApp.onAppUpdateAvailable(function(updateCallback) {
    // This function is called when a new version of your Mendix app is available.
    // Invoke the callback to trigger the app update mechanism.
});
*/
