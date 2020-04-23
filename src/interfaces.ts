import {ObjectId} from 'bson'

export interface User {
    fName: string;
    lName: string;
    email: string;
    phone: string;
}

export interface UserDocInternal extends User {
    _id: string;
    password: string;
}

export interface SuccessfulLoginResult {
    user: User;
    events: (AggBaseEvent) [],
    organizations: OrganizationDoc []
    token: string;
}

export interface CreateUserPayload extends User {
    _id?: ObjectId;
    password: string;
}

export interface TokenPayload {
    user_id: string;
}

export interface EventTokenPayload extends TokenPayload {
    event_id: string;
}

export interface NewEventBody {
    token?: string;
    new_user?: CreateUserPayload;
    event: BaseEventRaw;
    organization?: Organization;
    organization_id?: string
}

export interface BaseEventRaw {
    type: EventType
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    is_private: string | boolean;
    keywords: string [];
    pic_urls: string [];
    contacts: Contacts [];
    goal_amount: string;
}

export interface BaseEvent extends BaseEventRaw {
    created_by_id: string | ObjectId;
    organization_id: string | ObjectId;
    admin_ids: (string | UserDocInternal)[];
    member_ids: (string | UserDocInternal)[];
}

export interface AggBaseEvent extends BaseEventRaw {
    created_by_id: string | ObjectId;
    organization_id: string | ObjectId;
    admins: UserDocInternal [];
    members: UserDocInternal [];
}

export interface TicketedEventDoc extends BaseEvent {
    _id: string;
    address: string;
    website: string;
    sponsor_levels: SponsorLevel [];
    additional_donations: boolean;
    is_limit: boolean;
}

export interface FundRaiseEventDoc extends BaseEvent {
    _id: string;
    is_prize: boolean;
    prizes?: Prize [];
}

interface Prize {
    description: string;
    pic_url: string;
    qty: number;
}

export enum EventType {
    Fundraiser = "Fundraiser",
    Ticketed = "Ticketed"
}

interface SponsorLevel {
    name: string;
    price: string;
    description: string;
}

interface Contacts {
    name: string;
    email: string;
    phone: string;
    title?: string;
}

export interface Organization {
    created_by_id: ObjectId;
    name: string;
    description: string;
    address: string;
    phone: string;
    website: string;
    logo_url: string;
    bank: {
        name: string;
        account: string;
        routing: string;
    }
}

export interface OrganizationDoc extends Organization{
    _id: string | ObjectId ;
}

export interface UserEventsAndOrgsResponse {
    events: (AggBaseEvent) [];
    organizations: OrganizationDoc []
}