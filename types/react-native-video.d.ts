declare module "react-native-video" {
  import type {
    ReactVideoProps as BaseReactVideoProps,
    VideoRef,
  } from "react-native-video/lib/types";
  import type { ForwardRefExoticComponent, RefAttributes } from "react";

  export * from "react-native-video/lib/types";
  export { VideoDecoderProperties } from "react-native-video/lib/VideoDecoderProperties";

  // Allow PiP flag; library supports it but it's missing in typings
  export interface ReactVideoProps extends BaseReactVideoProps {
    pictureInPicture?: boolean;
  }

  const Video: ForwardRefExoticComponent<
    ReactVideoProps & RefAttributes<VideoRef>
  >;

  export default Video;
}
