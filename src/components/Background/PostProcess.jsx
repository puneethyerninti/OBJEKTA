/**
 * README: Internal post-processing for BlobBackground. Import and use inside its Canvas.
 */
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

/** @typedef {'high' | 'medium' | 'low'} Quality */

/**
 * @param {{
 *  quality: Quality,
 *  downsampleScale: number,
 *  bloomIntensity: number,
 *  bloomThreshold: number,
 *  bloomSmoothing: number,
 *  vignetteDarkness: number
 * }} props
 */
const PostProcess = ({
  quality,
  downsampleScale,
  bloomIntensity,
  bloomThreshold,
  bloomSmoothing,
  vignetteDarkness,
}) => {
  const multisampling = quality === 'high' ? 4 : 0;

  return (
    <EffectComposer resolutionScale={downsampleScale} multisampling={multisampling}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={bloomSmoothing}
        mipmapBlur
        blendFunction={BlendFunction.SCREEN}
      />
      <Vignette eskil={false} offset={0.2} darkness={vignetteDarkness} />
    </EffectComposer>
  );
};

export default PostProcess;
