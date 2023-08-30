/**
 * Adds all default event listeners to pass signaling information between two calls.
 * For more details see the <a href="https://voximplant.com/docs/references/voxengine/voxengine/easyprocess">online documentation</a>.
 * @param {Call} call1 Incoming alerting call
 * @param {Call} call2 Newly created outgoing call
 * @param {Function} [onEstablishedCallback] Function to be called once the call is established. Both call1 and call2 are passed to this function as parameters
 * @param {Boolean} [direct] If it is true, the P2P mode will be enabled. It is false by default.
 */
VoxEngine.easyProcess = (call1, call2, onEstablishedCallback, direct) => {
  const defaultHangupHandler = (e) => {
    JSession.close();
  };

  call2.addEventListener(CallEvents.Connected, (e) => {
    if (direct) {
      call1.answerDirect(call2, e.headers, {
        displayName: e.call.displayName(),
      });
    } else {
      const parameters = {
        displayName: e.call.displayName(),
      };
      if (e.scheme && !(call1.is_conf || call2.is_conf)) {
        parameters.scheme = e.scheme;
      }
      call1.answer(e.headers, parameters);
    }
  });

  VoxEngine.sendMediaBetween(call1, call2);

  if (typeof onEstablishedCallback === 'function') {
    call1.addEventListener(CallEvents.Connected, (e) => {
      onEstablishedCallback(call1, call2);
    });
  }

  call2.addEventListener(CallEvents.Ringing, (e) => {
    call1.ring();
  });

  call2.addEventListener(CallEvents.AudioStarted, (e) => {
    if (e.scheme) {
      call1.startEarlyMedia(null, e.scheme);
    } else {
      call1.startEarlyMedia();
    }
  });

  call2.addEventListener(CallEvents.MessageReceived, (e) => {
    call1.sendMessage(e.text);
  });
  call1.addEventListener(CallEvents.MessageReceived, (e) => {
    call2.sendMessage(e.text);
  });

  call2.addEventListener(CallEvents.InfoReceived, (e) => {
    call1.sendInfo(e.mimeType, e.body, e.headers);
  });
  call1.addEventListener(CallEvents.InfoReceived, (e) => {
    call2.sendInfo(e.mimeType, e.body, e.headers);
  });

  call2.addEventListener(CallEvents.ReInviteReceived, (e) => {
    if (call2.clientType() === 'pstn' || (call1 && typeof call1.reInvite === 'undefined')) {
      if (e.mimeType === 'application/json') {
        e.call.acceptReInvite(e.headers, 'application/sdp', '');
      }
    } else if (call1) {
      call1.reInvite(e.headers, e.mimeType, e.body);
    }
  });
  call1.addEventListener(CallEvents.ReInviteReceived, (e) => {
    if (call1.clientType() === 'pstn' || (call2 && typeof call2.reInvite === 'undefined')) {
      if (e.mimeType === 'application/json') {
        e.call.acceptReInvite(e.headers, 'application/sdp', '');
      }
    } else if (call2) {
      call2.reInvite(e.headers, e.mimeType, e.body);
    }
  });

  call2.addEventListener(CallEvents.ReInviteAccepted, (e) => {
    if (call1 && call1.clientType() !== 'pstn') {
      call1.acceptReInvite(e.headers, e.mimeType, e.body);
    }
  });
  call1.addEventListener(CallEvents.ReInviteAccepted, (e) => {
    if (call2 && call2.clientType() !== 'pstn') {
      call2.acceptReInvite(e.headers, e.mimeType, e.body);
    }
  });

  call2.addEventListener(CallEvents.ReInviteRejected, (e) => {
    const parameters = {
      code: e.code,
      reason: e.reason,
    };
    call1.rejectReInvite(e.headers, parameters);
  });
  call1.addEventListener(CallEvents.ReInviteRejected, (e) => {
    const parameters = {
      code: e.code,
      reason: e.reason,
    };
    call2.rejectReInvite(e.headers, parameters);
  });

  call1.addEventListener(CallEvents.Failed, defaultHangupHandler);
  call1.addEventListener(CallEvents.Disconnected, defaultHangupHandler);
  call2.addEventListener(CallEvents.Failed, defaultHangupHandler);
  call2.addEventListener(CallEvents.Disconnected, defaultHangupHandler);
};

/**
 * Helper function to forward an incoming call to PSTN. The method handles numbers only in the E.164 format by default. If you need to handle a number in another format, pass an additional function (as a parameter) to the method.
 * For more details see the <a href="https://voximplant.com/docs/references/voxengine/voxengine/forwardcalltopstn">online documentation</a>.
 * @param {Function} [numberTransform] Optional function used to transform dialed number to international format. This function accepts dialed number and must return phone number in E.164 format
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 * @param {Object} [options] An object with a number used as callerid that will be displayed to the called user. Whitespaces are not allowed. A valid phone number that can be used to call back is required.
 */
VoxEngine.forwardCallToPSTN = (numberTransform, onEstablishedCallback, options) => {
  VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    const number =
      typeof numberTransform === 'function' ? numberTransform(e.destination) : e.destination;
    const callOptions = {};
    if (options && options.followDiversion) {
      callOptions.followDiversion = options.followDiversion;
    }
    const callerid = options && options.callerid ? options.callerid : e.callerid;
    const newCall = VoxEngine.callPSTN(number, callerid, callOptions);
    VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
  });
};

/**
 * Helper function to forward an incoming call to a user of the current application. Dialed number is considered as username.
 * For more details see the <a href="https://voximplant.com/docs/references/voxengine/voxengine/forwardcalltouser">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 * @param {Boolean} [video] Specifies if the call should have video support. Please note that the price for audio-only and video calls is different!
 */
VoxEngine.forwardCallToUser = (onEstablishedCallback, video) => {
  VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    const newCall = VoxEngine.callUser(
      e.destination,
      e.callerid,
      e.displayName,
      null,
      video,
      e.scheme
    );
    VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
  });
};

/**
 * Helper function to forward an incoming call to a user of the current application in the P2P mode. Dialed number is considered as username. Due to the P2P mode, audio playback and recording will not work.
 * For more details see the <a href="https://voximplant.com/docs/references/voxengine/voxengine/forwardcalltouserdirect">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 */
VoxEngine.forwardCallToUserDirect = (onEstablishedCallback) => {
  VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    const newCall = VoxEngine.callUserDirect(e.call, e.destination, {
      callerid: e.callerid,
      displayName: e.displayName,
      extraHeaders: null,
    });
    VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback, true);
  });
};

/**
 * Helper function to forward an incoming call to a dialed SIP URI.
 * For more details see the <a href="https://voximplant.com/docs/references/voxengine/voxengine/forwardcalltosip">online documentation</a>.
 * @param {Function} [onEstablishedCallback] Optional function that is invoked after call is established. Both calls (incoming and outgoing) are passed to this function
 * @param {Boolean} [video] Specifies if the call should have video support. Please note that the price for audio-only and video calls is different!
 */
VoxEngine.forwardCallToSIP = function (onEstablishedCallback, video) {
  VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    const newCall = VoxEngine.callSIP(e.toURI, e.callerid, e.displayName, null, null, null, video);
    VoxEngine.easyProcess(e.call, newCall, onEstablishedCallback);
  });
};
