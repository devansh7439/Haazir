import {
  TranslateIcon,
  HeartbeatIcon,
  GearIcon,
  DropIcon,
  DotsThreeIcon,
  BugIcon,
  BrainIcon,
  BandaidsIcon,
  BabyIcon,
  ArrowBendUpRightIcon,
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  BellIcon,
  BuildingsIcon,
  CaretDownIcon,
  CaretUpIcon,
  XIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardTextIcon,
  ClockIcon,
  HeadphonesIcon,
  InfoIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MicrophoneIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  PhoneCallIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  PlusCircleIcon,
  ProhibitIcon,
  PulseIcon,
  QuestionIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UserCircleIcon,
  WarningCircleIcon,
  WarningIcon,
  XCircleIcon,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import type { IconKey } from '../../lib/display';

const ICONS = {
  alert: WarningIcon,
  baby: BabyIcon,
  bandage: BandaidsIcon,
  brain: BrainIcon,
  bug: BugIcon,
  more: DotsThreeIcon,
  drop: DropIcon,
  settings: GearIcon,
  heartbeat: HeartbeatIcon,
  language: TranslateIcon,
  'alert-circle': WarningCircleIcon,
  back: ArrowLeftIcon,
  bell: BellIcon,
  check: CheckIcon,
  'check-circle': CheckCircleIcon,
  'chevron-down': CaretDownIcon,
  'chevron-up': CaretUpIcon,
  clock: ClockIcon,
  close: XIcon,
  directions: NavigationArrowIcon,
  edit: PencilSimpleIcon,
  headphones: HeadphonesIcon,
  hospital: BuildingsIcon,
  info: InfoIcon,
  list: ClipboardTextIcon,
  lock: LockIcon,
  message: ChatCircleIcon,
  mic: MicrophoneIcon,
  pin: MapPinIcon,
  phone: PhoneIcon,
  'phone-call': PhoneCallIcon,
  'phone-incoming': PhoneIncomingIcon,
  plus: PlusCircleIcon,
  pulse: PulseIcon,
  redial: ArrowClockwiseIcon,
  search: MagnifyingGlassIcon,
  'sign-out': SignOutIcon,
  sliders: SlidersHorizontalIcon,
  star: StarIcon,
  user: UserCircleIcon,
} as const;

export type IconName = keyof typeof ICONS;

/** The icon for a name, so screens say what the icon means and never import a glyph. */
export const iconFor = (name: IconName): PhosphorIcon => ICONS[name];

// The statuses a hospital's answer can have, each drawn as a line icon (never emoji).
const STATUS_ICONS: Record<IconKey, PhosphorIcon> = {
  queued: ClockIcon,
  ringing: PhoneCallIcon,
  oncall: PhoneIncomingIcon,
  check: CheckCircleIcon,
  x: XCircleIcon,
  phone: PhoneIcon,
  callback: ArrowCounterClockwiseIcon,
  redirect: ArrowBendUpRightIcon,
  ban: ProhibitIcon,
  help: QuestionIcon,
  lock: LockIcon,
};

/** The line icon for a hospital's status, in the colour of its pill. */
export function StatusIcon({ icon, size = 15, color }: { icon: IconKey; size?: number; color: string }) {
  const Glyph = STATUS_ICONS[icon];
  return <Glyph size={size} color={color} weight="bold" />;
}

export type IconProps = { name: IconName; size?: number; color: string; weight?: 'regular' | 'bold' | 'fill' };

/** Draws the icon a name stands for, in the given size and colour. */
export default function Icon({ name, size = 18, color, weight = 'bold' }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} weight={weight} />;
}
