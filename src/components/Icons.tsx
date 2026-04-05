import React from 'react';

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const Icon = ({ name, className, style }: IconProps & { name: string }) => (
  <span className={`material-symbols-outlined ${className || ''}`} style={style}>{name}</span>
);

export const Bolt = (p: IconProps) => <Icon name="bolt" {...p} />;
export const Groups = (p: IconProps) => <Icon name="groups" {...p} />;
export const Leaderboard = (p: IconProps) => <Icon name="leaderboard" {...p} />;
export const Person = (p: IconProps) => <Icon name="person" {...p} />;
export const Menu = (p: IconProps) => <Icon name="menu" {...p} />;
export const CheckCircle = (p: IconProps) => <Icon name="check_circle" {...p} />;
export const AddAPhoto = (p: IconProps) => <Icon name="add_a_photo" {...p} />;
export const UploadFile = (p: IconProps) => <Icon name="upload_file" {...p} />;
export const Schedule = (p: IconProps) => <Icon name="schedule" {...p} />;
export const FormatQuote = (p: IconProps) => <Icon name="format_quote" {...p} />;
export const Add = (p: IconProps) => <Icon name="add" {...p} />;
export const Favorite = (p: IconProps) => <Icon name="favorite" {...p} />;
export const FavoriteBorder = (p: IconProps) => <Icon name="favorite_border" {...p} />;
export const ChatBubble = (p: IconProps) => <Icon name="chat_bubble" {...p} />;
export const Logout = (p: IconProps) => <Icon name="logout" {...p} />;
export const MilitaryTech = (p: IconProps) => <Icon name="military_tech" {...p} />;
export const CalendarToday = (p: IconProps) => <Icon name="calendar_today" {...p} />;
export const Search = (p: IconProps) => <Icon name="search" {...p} />;
export const PersonAdd = (p: IconProps) => <Icon name="person_add" {...p} />;
export const MoreVert = (p: IconProps) => <Icon name="more_vert" {...p} />;
export const WaterDrop = (p: IconProps) => <Icon name="water_drop" {...p} />;
export const FitnessCenter = (p: IconProps) => <Icon name="fitness_center" {...p} />;
export const MenuBook = (p: IconProps) => <Icon name="menu_book" {...p} />;
export const DirectionsRun = (p: IconProps) => <Icon name="directions_run" {...p} />;
export const SelfImprovement = (p: IconProps) => <Icon name="self_improvement" {...p} />;
export const Edit = (p: IconProps) => <Icon name="edit" {...p} />;
export const Delete = (p: IconProps) => <Icon name="delete" {...p} />;
export const Close = (p: IconProps) => <Icon name="close" {...p} />;
export const CameraAlt = (p: IconProps) => <Icon name="camera_alt" {...p} />;
export const Save = (p: IconProps) => <Icon name="save" {...p} />;
export const Send = (p: IconProps) => <Icon name="send" {...p} />;
export const Image = (p: IconProps) => <Icon name="image" {...p} />;
export const EmojiEvents = (p: IconProps) => <Icon name="emoji_events" {...p} />;
export const LocalFireDepartment = (p: IconProps) => <Icon name="local_fire_department" {...p} />;
export const NoFood = (p: IconProps) => <Icon name="no_food" {...p} />;
export const PhotoCamera = (p: IconProps) => <Icon name="photo_camera" {...p} />;
export const RestaurantMenu = (p: IconProps) => <Icon name="restaurant_menu" {...p} />;
export const Bedtime = (p: IconProps) => <Icon name="bedtime" {...p} />;
export const MonitorHeart = (p: IconProps) => <Icon name="monitor_heart" {...p} />;
export const Hiking = (p: IconProps) => <Icon name="hiking" {...p} />;
export const Psychology = (p: IconProps) => <Icon name="psychology" {...p} />;
export const Park = (p: IconProps) => <Icon name="park" {...p} />;
export const Spa = (p: IconProps) => <Icon name="spa" {...p} />;
export const TaskAlt = (p: IconProps) => <Icon name="task_alt" {...p} />;
export const CenterFocusStrong = (p: IconProps) => <Icon name="center_focus_strong" {...p} />;
