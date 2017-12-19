/**
 * Adds all default event listeners to pass signaling information between two calls.
 * For more details see the <a href="https://voximplant.com/docs/references/appengine/VoxEngine.html#VoxEngine_easyProcess">online documentation</a>.
 * @param {Call} call1 Incoming alerting call
 * @param {Call} call2 Newly created outgoing call
 * @param {Function} [onEstablishedCallback] Function to be called once call is established. Both <b>call1</b> and <b>call2</b> are passed to this function as parameters
 * @param {Boolean} [direct] If it's true, P2P mode will be enabled. It's false by default.
 */
VoxEngine.easyProcess = function (call1, call2, onEstablishedCallback, direct) {
    const defaultHangupHandler = function (e) {
        JSession.close();
    };

    call2.addEventListener(CallEvents.Connected, function (e) {
        if (direct) {
            call1.answerDirect(call2);
        } else {
            if(e.scheme && !(call1.is_conf || call2.is_conf))
                call1.answer(null,{scheme:e.scheme});
            else
                call1.answer();
        }
    });

    VoxEngine.sendMediaBetween(call1, call2);
    if (typeof onEstablishedCallback === 'function') {
        call1.addEventListener(CallEvents.Connected, function (e) {
            onEstablishedCallback(call1, call2);
        });
    }
    call2.addEventListener(CallEvents.Ringing, function (e) {
        call1.ring();
    });
    call2.addEventListener(CallEvents.AudioStarted, function (e) {
        if(e.scheme)
            call1.startEarlyMedia(null,e.scheme);
        else
            call1.startEarlyMedia();
    });

    call2.addEventListener(CallEvents.MessageReceived, function (e) {
        call1.sendMessage(e.text);
    });
    call1.addEventListener(CallEvents.MessageReceived, function (e) {
            call2.sendMessage(e.text);
    });
    call2.addEventListener(CallEvents.InfoReceived, function (e) {
        call1.sendInfo(e.mimeType, e.body, e.headers);
    });
    call1.addEventListener(CallEvents.InfoReceived, function (e) {
            call2.sendInfo(e.mimeType, e.body, e.headers);
        }
    );

    call2.addEventListener(CallEvents.ReInviteReceived, function (e) {
        if (call1)
            call1.reInvite(e.headers, e.mimeType, e.body);
    });
    call1.addEventListener(CallEvents.ReInviteReceived, function (e) {
        if (call2)
            call2.reInvite(e.headers, e.mimeType, e.body);
    });

    call2.addEventListener(CallEvents.ReInviteAccepted, function (e) {
        if (call1)
            call1.acceptReInvite(e.headers, e.mimeType, e.body);
    });
    call1.addEventListener(CallEvents.ReInviteAccepted, function (e) {
        if (call2)
            call2.acceptReInvite(e.headers, e.mimeType, e.body);
    });
    call2.addEventListener(CallEvents.ReInviteRejected, function (e) {
        call1.rejectReInvite(e.headers);
    });
    call1.addEventListener(CallEvents.ReInviteRejected, function (e) {
        call2.rejectReInvite(e.headers);
    });


    call1.addEventListener(CallEvents.Failed, defaultHangupHandler);
    call1.addEventListener(CallEvents.Disconnected, defaultHangupHandler);
    call2.addEventListener(CallEvents.Failed, defaultHangupHandler);
    call2.addEventListener(CallEvents.Disconnected, defaultHangupHandler);
};

/**
 * Helper function to forward incoming call to PSTN. The method handles numbers only in E.164 format by default. If you need to handle a number in another format, pass additional function (as a parameter) to the method.
 * For more details see the <a href="https://voximplant.com/docs/references/appengine/VoxEngine.html#VoxEngine_forwardCallToPSTN">online documentation</a>.
 * @param {Function} [numberTransform] Optional function used to transform dialed number to international format. This function accepts dialed number and must return phone number in E.164 format
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 */
VoxEngine.forwardCallToPSTN = function (numberTransform, onEstablishedCallback) {
    VoxEngine.addEventListener(AppEvents.CallAlerting, (e)=> {
        let number = e.destination;
        if (typeof(numberTransform) === 'function') {
            number = numberTransform(number);
        }
        const newCall = VoxEngine.callPSTN(number, e.callerid);
        VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
    });
};

/**
 * Helper function to forward incoming call to user of <b>current</b> application. Dialed number is interpreted as username.
 * For more details see the <a href="https://voximplant.com/docs/references/appengine/VoxEngine.html#VoxEngine_forwardCallToUser">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 * @param {Boolean} [video] Specifies if call should have video support. <b>Please note that price for audio-only and video calls is different!</b>
 */
VoxEngine.forwardCallToUser = function (onEstablishedCallback, video) {
    VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
        const newCall = VoxEngine.callUser(e.destination, e.callerid, e.displayName, null, video, e.scheme);
        VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
    });
};

/**
 * Helper function to forward incoming call to user of current application <b>in P2P mode</b>. Dialed number is interpreted as username. Due to P2P mode, audio playback and recording will not make any effect.
 * For more details see the <a href="https://voximplant.com/docs/references/appengine/VoxEngine.html#VoxEngine_forwardCallToUserDirect">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 */
VoxEngine.forwardCallToUserDirect = function (onEstablishedCallback) {
    VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
        const newCall = VoxEngine.callUserDirect(e.call, e.destination, e.callerid, e.displayName, null);
        VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback, true);
    });
};

/**
 * Helper function to forward incoming call to dialed SIP URI.
 * For more details see the <a href="https://voximplant.com/docs/references/appengine/VoxEngine.html#VoxEngine_forwardCallToSIP">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 * @param {Boolean} [video] Specifies if call should have video support. <b>Please note that price for audio-only and video calls is different!</b>
 */
VoxEngine.forwardCallToSIP = function (onEstablishedCallback, video) {
    VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
        const newCall = VoxEngine.callSIP(e.toURI, e.callerid, e.displayName, null, null, null, video);
        VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
    });
};
