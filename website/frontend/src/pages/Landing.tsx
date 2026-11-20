import { useLanguage } from "../contexts/languageContext";
import TikTokIcon from "../assets/tiktok-icon.svg";
import TwitchIcon from "../assets/twitch-icon.svg";
import YouTubeIcon from "../assets/youtube-icon.svg";
import InstagramIcon from "../assets/instagram-icon.svg";
import Discord from "../assets/discord-official.svg";

export function Landing() {
  const { localization } = useLanguage();

  const socials = [
    {
      name: "Twitch",
      icon: TwitchIcon,
      handle: localization.landing.l_handle_twitch,
      link: "https://www.twitch.tv/kevaksss"
    },
    {
      name: "TikTok",
      icon: TikTokIcon,
      handle: localization.landing.l_handle_tiktok,
      link: "https://www.tiktok.com/@kevaks"
    },
    {
      name: "YouTube",
      icon: YouTubeIcon,
      handle: localization.landing.l_handle_youtube,
      link: "https://www.youtube.com/@Kevaks"
    },
    {
      name: "Instagram",
      icon: InstagramIcon,
      handle: localization.landing.l_handle_instagram,
      link: "https://www.instagram.com/kevakss/"
    },
  ];

  return (
    <div className="PageContainer LandingPage">
      <h1>{localization.landing.l_title}</h1>
      <div className="SolcialsField">
        <span className="DiscordText">{localization.landing.l_subtitle}</span>
      <div className="SocialRow">
        {socials.map((social) => (
          <a href={social.link} className="SocialItem" key={social.name}>
            <img className="SocialIcon" src={social.icon} alt={social.name} />
            <span className="SocialHandle">{social.handle}</span>
          </a>
        ))}
      </div>
      </div>
      <div>
          <a href="https://discord.gg/DAS5pP4KAB" className="DiscordItem" key="dc">
            <span className="DiscordText">Join meinem Discord:</span>
            <img className="DiscordIcon" src={Discord} alt={"Discord Link"} />
          </a>
      </div>
    </div>
  );
}
