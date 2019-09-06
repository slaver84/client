import logger from '../../logger'
import * as FsGen from '../fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Saga from '../../util/saga'
import {TypedState} from '../../constants/reducer'
import {parseUri, launchImageLibraryAsync} from '../../util/expo-image-picker'
import {makeRetriableErrorHandler} from './shared'
import {saveAttachmentDialog, showShareActionSheetFromURL} from '../platform-specific'

const pickAndUploadToPromise = (_: TypedState, action: FsGen.PickAndUploadPayload): Promise<any> =>
  launchImageLibraryAsync(action.payload.type)
    .then(result =>
      result.cancelled === true
        ? null
        : FsGen.createUpload({
            localPath: parseUri(result),
            parentPath: action.payload.parentPath,
          })
    )
    .catch(makeRetriableErrorHandler(action))

const finishedDownloadWithIntent = (state: TypedState, action: FsGen.FinishedDownloadWithIntentPayload) => {
  const {downloadID, downloadIntent, mimeType} = action.payload
  const downloadState = state.fs.downloads.state.get(downloadID, Constants.emptyDownloadState)
  if (downloadState === Constants.emptyDownloadState) {
    logger.warn('missing download', downloadID)
    return
  }
  const {localPath} = downloadState
  switch (downloadIntent) {
    case Types.DownloadIntent.CameraRoll:
      return saveAttachmentDialog(localPath)
        .then(() => FsGen.createDismissDownload({downloadID}))
        .catch(makeRetriableErrorHandler(action))
    case Types.DownloadIntent.Share:
      // @ts-ignore codemod-issue probably a real issue
      return showShareActionSheetFromURL({mimeType, url: localPath})
        .then(() => FsGen.createDismissDownload({downloadID}))
        .catch(makeRetriableErrorHandler(action))
    case Types.DownloadIntent.None:
      return
    default:
      return undefined
  }
}

export default function* nativeSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(FsGen.pickAndUpload, pickAndUploadToPromise)
  yield* Saga.chainAction2(FsGen.finishedDownloadWithIntent, finishedDownloadWithIntent)
}
