async function loadVessels(){
  return window.loadVesselsImpl();
}

async function loadVesselDetails(vesselId){
  return window.loadVesselDetailsImpl(vesselId);
}

function closeVesselDetails(){
  return window.closeVesselDetailsImpl();
}

function bindVesselRowClicks(){
  return window.bindVesselRowClicksImpl();
}

function applyLiveVessels(){
  return window.applyLiveVesselsImpl();
}
