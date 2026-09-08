function openVesselManagementModal(){
  window.openVesselManagementModalImpl();
}

function initVesselManagement(){
  const addButton =
    document.getElementById("addVesselBtn");

  if(!addButton){
    console.warn(
      "Add Vessel button not found."
    );
    return;
  }

  addButton.addEventListener(
    "click",
    openVesselManagementModal
  );
}

function openEditVesselModal(vesselId){
  window.openEditVesselModalImpl(vesselId);
}
