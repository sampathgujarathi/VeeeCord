/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addBadge, BadgePosition, ProfileBadge, removeBadge } from "@api/Badges";
import { addDecoration, removeDecoration } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { copyWithToast } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { Button, Forms, Toasts, Tooltip, useEffect, useState } from "@webpack/common";
import { User } from "discord-types/general";
import virtualMerge from "virtual-merge";

import { API_URL, BASE_URL, INVITE_KEY, SKU_ID, VERSION } from "./constants";
const CustomizationSection = findByCodeLazy(".customizationSectionBackground");
const cl = classNameFactory("vc-decoration-");

import style from "./index.css?managed";

type Badge = {
    id: string;
    description: string;
    icon: string;
    link?: string;
};
export interface AvatarDecoration {
    asset: string;
    skuId: string;
}
interface UserProfile extends User {
    profileEffectId: string;
    userId: string;

}
interface UserProfileData {
    profile_effect: string;
    banner: string;
    avatar: string;
    badges: Badge[];
    decoration: string;
}


let UsersData = {} as Record<string, UserProfileData>;
const UserBadges: Record<string, ProfileBadge[]> = {};
const addBadgesForAllUsers = () => {
    Object.keys(UsersData).forEach(userId => {
        const userBadges_ = UsersData[userId].badges;
        if (userBadges_) {
            userBadges_.forEach((badge: Badge) => {
                const newBadge: ProfileBadge = {
                    description: badge.description,
                    image: badge.icon,
                    position: BadgePosition.START,
                    props: {
                        style: {
                            borderRadius: "50%",
                            transform: "scale(0.9)"
                        }
                    },
                    shouldShow: user => user.user.id === userId,
                };
                addBadge(newBadge);
                if (!UserBadges[userId]) {
                    UserBadges[userId] = [];
                }
                UserBadges[userId].push(newBadge);
            });
        }
    });
};

const removeBadgesForAllUsers = () => {
    Object.keys(UserBadges).forEach(userId => {
        const userBadges = UserBadges[userId];
        if (userBadges) {
            userBadges.forEach(badge => {
                removeBadge(badge);
            });
            UserBadges[userId] = [];
        }
    });
};
async function loadfakeProfile(noCache = false) {
    UsersData = {};
    const init = {} as RequestInit;
    if (noCache)
        init.cache = "no-cache";
    const response = await fetch(API_URL + "/fakeProfile", init);
    const data = await response.json();
    UsersData = data;
}

function getUserEffect(profileId: string) {
    const userEffect = UsersData[profileId];
    if (userEffect) {
        return UsersData[profileId].profile_effect || null;
    }
    return null;
}
interface UserProfile extends User {
    themeColors?: Array<number>;
}

interface Colors {
    primary: number;
    accent: number;
}

function encode(primary: number, accent: number): string {
    const message = `[#${primary.toString(16).padStart(6, "0")},#${accent.toString(16).padStart(6, "0")}]`;
    const padding = "";
    const encoded = Array.from(message)
        .map(x => x.codePointAt(0))
        .filter(x => x! >= 0x20 && x! <= 0x7f)
        .map(x => String.fromCodePoint(x! + 0xe0000))
        .join("");

    return (padding || "") + " " + encoded;
}

function decode(bio: string): Array<number> | null {
    if (bio == null) return null;
    const colorString = bio.match(
        /\u{e005b}\u{e0023}([\u{e0061}-\u{e0066}\u{e0041}-\u{e0046}\u{e0030}-\u{e0039}]+?)\u{e002c}\u{e0023}([\u{e0061}-\u{e0066}\u{e0041}-\u{e0046}\u{e0030}-\u{e0039}]+?)\u{e005d}/u,
    );
    if (colorString != null) {
        const parsed = [...colorString[0]]
            .map(x => String.fromCodePoint(x.codePointAt(0)! - 0xe0000))
            .join("");
        const colors = parsed
            .substring(1, parsed.length - 1)
            .split(",")
            .map(x => parseInt(x.replace("#", "0x"), 16));

        return colors;
    } else {
        return null;
    }
}


const settings = definePluginSettings({
    enableProfileEffects: {
        description: "Allows you to use profile effects",
        type: OptionType.BOOLEAN,
        default: false
    },
    enableProfileThemes: {
        description: "Allows you to use profile themes",
        type: OptionType.BOOLEAN,
        default: false
    },
    enableCustomBadges: {
        description: "Allows you to use custom badges",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    },
    enableAvatarDecorations: {
        description: "Allows you to use discord avatar decorations",
        type: OptionType.BOOLEAN,
        default: false
    },
    showCustomBadgesinmessage: {
        description: "Show custom badges in message",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    },
    nitroFirst: {
        description: "Banner/Avatar to use if both Nitro and fakeProfile Banner/Avatar are present",
        type: OptionType.SELECT,
        options: [
            { label: "Nitro", value: true, default: true },
            { label: "fakeProfile", value: false },
        ]
    },
    voiceBackground: {
        description: "Use fakeProfile banners as voice chat backgrounds",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true
    }
});
function ImageIcon(path: string) {
    return ({ tooltip }: { tooltip: string; }) => (
        <Tooltip text={tooltip} >
            {(tooltipProps: any) => (
                <img {...tooltipProps} src={path} height={20} width={20} />
            )}
        </Tooltip>
    );
}
const BadgeIcon = ({ user, badgeImg, badgeText }: { user: User, badgeImg: string, badgeText: string; }) => {
    if (UsersData[user.id]?.badges) {
        const Icon = ImageIcon(badgeImg);
        const tooltip = badgeText;
        return <Icon tooltip={tooltip} />;
    } else {
        return null;
    }
};



const BadgeMain = ({ user, wantMargin = true, wantTopMargin = false }: { user: User; wantMargin?: boolean; wantTopMargin?: boolean; }) => {

    const validBadges = UsersData[user.id]?.badges;
    if (!validBadges || validBadges.length === 0) return null;

    const icons = validBadges.map((badge: Badge, index: number) => (
        <BadgeIcon
            key={index}
            user={user}
            badgeImg={badge.icon}
            badgeText={badge.description}
        />
    ));

    return (
        <span
            className="custom-badge"
            style={{
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                marginLeft: wantMargin ? 4 : 0,
                verticalAlign: "top",
                position: "relative",
                top: wantTopMargin ? 2 : 0,
                padding: !wantMargin ? 1 : 0,
                gap: 2
            }}
        >
            {icons}
        </span>
    );
};



export default definePlugin({
    name: "fakeProfile",
    description: "Unlock Discord profile effects, themes, avatar decorations, and custom badges without the need for Nitro.",
    authors: [Devs.Sampath, Devs.Alyxia, Devs.Remty, Devs.AutumnVN, Devs.pylix, Devs.TheKodeToad],
    dependencies: ["MessageDecorationsAPI"],
    async start() {
        enableStyle(style);
        await loadfakeProfile();
        if (settings.store.enableCustomBadges) {
            addBadgesForAllUsers();
        }
        if (settings.store.showCustomBadgesinmessage) {
            addDecoration("custom-badge", props =>
                <ErrorBoundary noop>
                    <BadgeMain user={props.message?.author} wantTopMargin={true} />
                </ErrorBoundary>
            );
        }
        const response = await fetch(BASE_URL + "/fakeProfile");
        const data = await response.json();
        if (data.version !== VERSION) {
            Toasts.show({
                message: "There is an update available for the fakeProfile plugin.",
                id: Toasts.genId(),
                type: Toasts.Type.MESSAGE,
                options: {
                    position: Toasts.Position.BOTTOM
                }
            });
        }
    },
    stop() {
        if (settings.store.showCustomBadgesinmessage) {
            removeDecoration("custom-badge");
        }
    },
    patches: [
        {
            find: "UserProfileStore",
            replacement: {
                match: /(?<=getUserProfile\(\i\){return )(\i\[\i\])/,
                replace: "$self.profileDecodeHook($1)"
            }
        },
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\(\i\){)(?=let{avatarDecoration)/,
                replace: "const vcDecoration = (() => { return $self.getAvatarDecorationURL(arguments[0]); })(); if (vcDecoration) return vcDecoration;"
            }
        },
        {
            find: ".USER_SETTINGS_PROFILE_THEME_ACCENT",
            replacement: {
                match: /RESET_PROFILE_THEME}\)(?<=color:(\i),.{0,500}?color:(\i),.{0,500}?)/,
                replace: "$&,$self.addCopy3y3Button({primary:$1,accent:$2})"
            }
        },
        {
            find: "DefaultCustomizationSections",
            replacement: {
                match: /(?<={user:\i},"decoration"\),)/,
                replace: "$self.DecorationSection(),"
            }
        },
        {
            find: ".NITRO_BANNER,",
            replacement: [
                {
                    match: /(\i)\.premiumType/,
                    replace: "$self.premiumHook($1)||$&"
                },
                {
                    match: /(?<=function \i\((\i)\)\{)(?=var.{30,50},bannerSrc:)/,
                    replace: "$1.bannerSrc=$self.useBannerHook($1);"
                },
                {
                    match: /\?\(0,\i\.jsx\)\(\i,{type:\i,shown/,
                    replace: "&&$self.shouldShowBadge(arguments[0])$&"
                }
            ]
        },
        {
            find: "\"data-selenium-video-tile\":",
            predicate: () => settings.store.voiceBackground,
            replacement: [
                {
                    match: /(?<=function\((\i),\i\)\{)(?=let.{20,40},style:)/,
                    replace: "$1.style=$self.voiceBackgroundHook($1);"
                }
            ]
        },
        {
            find: "getUserAvatarURL:",
            replacement: [
                {
                    match: /(getUserAvatarURL:)(\i),/,
                    replace: "$1$self.getAvatarHook($2),"
                },
                {
                    match: /(getUserAvatarURL:\i\(\){return )(\i)}/,
                    replace: "$1$self.getAvatarHook($2)}"
                }
            ]
        },
        {
            find: "isAvatarDecorationAnimating:",
            group: true,
            replacement: [
                // Add Decor avatar decoration hook to avatar decoration hook
                {
                    match: /(?<=TryItOut:\i,guildId:\i}\),)(?<=user:(\i).+?)/,
                    replace: "vcAvatarDecoration=$self.useUserAvatarDecoration($1),"
                },
                // Use added hook
                {
                    match: /(?<={avatarDecoration:).{1,20}?(?=,)(?<=avatarDecorationOverride:(\i).+?)/,
                    replace: "$1??vcAvatarDecoration??($&)"
                },
                // Make memo depend on added hook
                {
                    match: /(?<=size:\i}\),\[)/,
                    replace: "vcAvatarDecoration,"
                }
            ]
        },
        {
            find: "renderAvatarWithPopout(){",
            replacement: [
                // Use Decor avatar decoration hook
                {
                    match: /(?<=getAvatarDecorationURL\)\({avatarDecoration:)(\i).avatarDecoration(?=,)/,
                    replace: "$self.useUserAvatarDecoration($1)??$&"
                }
            ]
        }
    ],
    settingsAboutComponent: () => (

        <Forms.FormSection>
            <Forms.FormTitle tag="h3">Usage</Forms.FormTitle>
            <Link href="https://github.com/sampathgujarathi/fakeProfile">CLICK HERE TO GET PROFILE EFFECTS, CUSTOM BADGES, BANNER OR ANIMATED PFP</Link>
            <Forms.FormText>
                Enable Profile Themes to use fake profile themes. <br />
                To set your own colors:
                <ul>
                    <li>• go to your profile settings</li>
                    <li>• choose your own colors in the Nitro preview</li>
                    <li>• click the "Copy 3y3" button</li>
                    <li>• paste the invisible text anywhere in your bio</li>
                </ul><br />
            </Forms.FormText>
        </Forms.FormSection>
    ),
    settings,
    profileDecodeHook(user: UserProfile) {
        if (user) {
            if (settings.store.enableProfileEffects || settings.store.enableProfileThemes) {
                let mergeData: Partial<UserProfile> = {};
                const profileEffect = getUserEffect(user.userId);
                const colors = decode(user.bio);
                if (settings.store.enableProfileEffects && profileEffect) {
                    mergeData = {
                        ...mergeData,
                        profileEffectId: profileEffect

                    };
                }

                if (settings.store.enableProfileThemes && colors) {
                    mergeData = {
                        ...mergeData,
                        premiumType: 2,
                        themeColors: colors
                    };
                }
                return virtualMerge(user, mergeData as UserProfile);
            }
            return user;
        }

        return user;
    },
    SKU_ID,
    useUserAvatarDecoration(user?: User): { asset: string; skuId: string; } | null {
        const [avatarDecoration, setAvatarDecoration] = useState<string | null>(null);
        useEffect(() => {
            const fetchUserAssets = async () => {
                try {
                    if (user?.id) {
                        const userAssetsData = UsersData[user.id];
                        if (userAssetsData?.decoration) {
                            setAvatarDecoration(userAssetsData.decoration);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user assets:", error);
                }
            };

            fetchUserAssets();
        }, [user, UsersData]);

        if (!user || !settings.store.enableAvatarDecorations) {
            return null;
        }
        return avatarDecoration ? { asset: avatarDecoration, skuId: SKU_ID } : null;
    },
    voiceBackgroundHook({ className, participantUserId }: any) {
        if (className.includes("tile_")) {
            if (UsersData[participantUserId]) {
                return {
                    backgroundImage: `url(${UsersData[participantUserId].banner})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                };
            }
        }
    },

    useBannerHook({ displayProfile, user }: any) {
        if (displayProfile?.banner && settings.store.nitroFirst) return;
        if (UsersData[user.id] && UsersData[user.id].banner) return UsersData[user.id].banner;
    },

    premiumHook({ userId }: any) {
        if (UsersData[userId]) return 2;
    },

    shouldShowBadge({ displayProfile, user }: any) {
        return displayProfile?.banner && (UsersData[user.id] || settings.store.nitroFirst);
    },
    getAvatarHook: (original: any) => (user: User, animated: boolean, size: number) => {
        if (!settings.store.nitroFirst && user.avatar?.startsWith("a_")) return original(user, animated, size);

        return UsersData[user.id]?.avatar ?? original(user, animated, size);
    },
    getAvatarDecorationURL({ avatarDecoration, canAnimate }: { avatarDecoration: AvatarDecoration | null; canAnimate?: boolean; }) {
        if (!avatarDecoration || !settings.store.enableAvatarDecorations) return;
        if (avatarDecoration && canAnimate) {
            const url = new URL(`https://cdn.discordapp.com/avatar-decoration-presets/${avatarDecoration?.asset}.png`);
            return url.toString();
        }
        const url = new URL(`https://cdn.discordapp.com/avatar-decoration-presets/${avatarDecoration?.asset}.png?passthrough=false`);
        return url.toString();
    },
    DecorationSection() {
        if (!settings.store.enableAvatarDecorations) return;
        return <CustomizationSection
            title={"fakeProfile"}
            hasBackground={true}
            hideDivider={false}
            className={cl("section-remove-margin")}
        >
            <Flex>
                <Button
                    onClick={async () => {
                        removeBadgesForAllUsers();
                        await loadfakeProfile(true);
                        addBadgesForAllUsers();
                        Toasts.show({
                            message: "Updated fakeProfile badges!",
                            id: Toasts.genId(),
                            type: Toasts.Type.SUCCESS
                        });
                    }}
                    size={Button.Sizes.SMALL}
                >
                    Reload fakeProfile
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    onClick={() => VencordNative.native.openExternal(`https://discord.gg/${INVITE_KEY}`)}
                >
                    Join Discord
                </Button>
            </Flex>
        </CustomizationSection>;
    },
    addCopy3y3Button: ErrorBoundary.wrap(function ({ primary, accent }: Colors) {
        return <Button
            onClick={() => {
                const colorString = encode(primary, accent);
                copyWithToast(colorString);
            }}
            color={Button.Colors.PRIMARY}
            size={Button.Sizes.XLARGE}
            className={Margins.left16}
        >Copy 3y3
        </Button >;
    }, { noop: true }),
});
