import React from "react";
import { ConnectedProps, connect } from "react-redux";

import { userData } from "shared/user-data/GraphQL/UserData";
import * as actions from "ui/actions/app";
import { setSelectedPrimaryPanel } from "ui/actions/layout";
import { isTestSuiteReplay } from "ui/components/TestSuite/utils/isTestSuiteReplay";
import { useGetRecording, useGetRecordingId } from "ui/hooks/recordings";
import { getSelectedSource } from "ui/reducers/sources";
import { UIState } from "ui/state";
import { PrimaryPanelName } from "ui/state/layout";

import { PrimaryButton, SecondaryButton } from "../Button";
import { Dialog, DialogActions, DialogDescription, DialogLogo, DialogTitle } from "../Dialog";
import Modal from "../NewModal";
import styles from "./modal.module.css";

function PassportDismissModal({
  hideModal,
  setSelectedPrimaryPanel,
  selectedSource,
}: PropsFromRedux) {
  const recordingId = useGetRecordingId();
  const { recording } = useGetRecording(recordingId);

  const confirmDismiss = () => {
    let initialPrimaryPanel: PrimaryPanelName;
    userData.set("feature_showPassport", false);
    if (recording && isTestSuiteReplay(recording)) {
      initialPrimaryPanel = "cypress";
    } else {
      initialPrimaryPanel = "events";
    }
    setSelectedPrimaryPanel(initialPrimaryPanel);
    hideModal();
  };

  const cancelDismiss = () => {
    hideModal();
  };

  return (
    <Modal options={{ maskTransparency: "translucent" }} onMaskClick={hideModal}>
      <Dialog className={styles.passportBackground} showFooterLinks={false}>
        <div className={styles.stamp}></div>
        <DialogTitle>Dismiss Passport?</DialogTitle>
        <DialogDescription className={styles.buttonContainer}>
          This feature can be re-enabled from settings.
        </DialogDescription>
        <DialogActions>
          <div className={styles.buttonContainer}>
            <PrimaryButton color="blue" onClick={confirmDismiss}>
              OK
            </PrimaryButton>
            <SecondaryButton
              color="gray"
              onClick={cancelDismiss}
              className={styles.secondaryButton}
            >
              Cancel
            </SecondaryButton>
          </div>
        </DialogActions>
      </Dialog>
    </Modal>
  );
}

const connector = connect(
  (state: UIState) => ({
    selectedSource: getSelectedSource(state)!,
  }),
  {
    hideModal: actions.hideModal,
    setSelectedPrimaryPanel,
  }
);

type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(PassportDismissModal);
