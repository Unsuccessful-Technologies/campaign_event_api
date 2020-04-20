
import { MongoClient, Db} from "mongodb";
import config from "../config";
import {
    BaseEvent,
    CreateUserPayload,
    FundRaiseEventDoc,
    Organization,
    OrganizationDoc, TicketedEventDoc,
    UserDocInternal
} from "../interfaces";

let db: Db

const StartDB = async () => {
    try {
        const client: MongoClient = await MongoClient.connect(config.mongodb.url, {useUnifiedTopology: true})
        db = await client.db(config.mongodb.database_name)
        return db
    } catch (err) {
        console.log(err)
    }
}

export default StartDB

/** Example for searching events */
// export const FindEvents = async (payload: FindEventsPayload) => {
//     const { search } = payload
//     const Users = db.collection('Users')
//     const query = {firstName:{$regex: `${search}.+`, $options:"i"}}
//
//     return await Users.find(query).toArray()
// }

export const CreateUser = async (payload: CreateUserPayload): Promise<UserDocInternal> => {
    const Users = db.collection('Users')
    const response = await Users.insertOne(payload)
    const result = {
        ...payload,
        _id: response.insertedId
    }
    return result
}

const GetUser = async (query: {[propName:string]: any}): Promise<UserDocInternal> => {
    const Users = db.collection('Users')
    return await Users.findOne(query)
}

export const GetUserByEmail = async (email: string): Promise<UserDocInternal> => {
    const query = {email}
    return GetUser(query)
}

export const UserExists = async (email: string): Promise<boolean> => {
    let result = true
    let user = await GetUserByEmail(email)
    return result && !!user

}

export const GetUserByID = async (_id: string) => {
    const query = {_id}
    return GetUser(query)
}

export const CreateOrganization = async (payload: Organization): Promise<OrganizationDoc> => {
    const Organizations = db.collection('Organizations')
    const response = await Organizations.insertOne(payload)
    const result = {
        ...payload,
        _id: response.insertedId
    }
    return result
}

export const CreateEvent = async (payload: BaseEvent): Promise<{event_id: string}> => {
    const Events = db.collection('Events')
    const response = await Events.insertOne(payload)
    const result = {
        event_id: response.insertedId
    }
    return result
}