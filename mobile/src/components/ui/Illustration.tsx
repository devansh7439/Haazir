import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ILLUSTRATION_RATIO, illustrationXml, type IllustrationName, type IllustrationTone } from './illustrations';

export type { IllustrationName };

/** One of the app's drawings (see `illustrations.ts`). It adds nothing a screen reader needs: the words beside it say the same. */
export default function Illustration({ name, width, tone = 'dark' }: { name: IllustrationName; width: number; tone?: IllustrationTone }) {
  const xml = useMemo(() => illustrationXml(name, tone), [name, tone]);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <SvgXml xml={xml} width={width} height={Math.round(width * ILLUSTRATION_RATIO)} />
    </View>
  );
}
