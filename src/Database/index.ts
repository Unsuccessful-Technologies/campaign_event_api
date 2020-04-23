
import { MongoClient, Db, ObjectId} from "mongodb";
import config from "../config";
import {
    AggBaseEvent,
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

export const GetManyUsers = async (user_ids: string []): Promise<UserDocInternal[]> => {
    const user_obj_ids: ObjectId [] = user_ids.map(id => new ObjectId(id))
    const Users = db.collection('Users')
    const query = { _id: { $in: user_obj_ids } }
    return await Users.find(query, {projection: {password: -1}}).toArray()
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

export const GetOrganizationsByUserID = async (user_id: string): Promise<OrganizationDoc[]> => {
    const Organizations = db.collection('Organizations')
    const query = {created_by_id: new ObjectId(user_id)}
    const response = await Organizations.find(query).toArray()
    return response
}

export const CreateEvent = async (payload: BaseEvent): Promise<{event_id: string}> => {
    const Events = db.collection('Events')
    const response = await Events.insertOne(payload)
    const result = {
        event_id: response.insertedId
    }
    return result
}

export const GetEventsByUserID = async (user_id: string): Promise<AggBaseEvent[]> => {
    const Events = db.collection('Events')
    const pipeline: Object [] = [
        {
            $match: {
                created_by_id: new ObjectId(user_id)
            }
        },
        {
            $set: {
                admin_ids: {
                    $map: {
                        input: "$admin_ids",
                        as: "id",
                        in: { $toObjectId: "$$id"}
                    }
                },
                member_ids: {
                    $map: {
                        input: "$member_ids",
                        as: "id",
                        in: { $toObjectId: "$$id"}
                    }
                }
            }
        },
        {
            $lookup: {
                from: "Users",
                localField: "admin_ids",
                foreignField: "_id",
                as: "admins"
            }
        },
        {
            $lookup: {
                from: "Users",
                localField: "member_ids",
                foreignField: "_id",
                as: "members"
            }
        },
        {
            $project: {
                admin_ids: 0,
                member_ids: 0
            }
        }
    ]
    const response = await Events.aggregate(pipeline).toArray()
    return response
}

export const GetEventByID = async (_id: string): Promise<AggBaseEvent> => {
    const Events = db.collection('Events')
    const pipeline: Object [] = [
        {
            $match: {
                _id: new ObjectId(_id)
            }
        },
        {
            $set: {
                admin_ids: {
                    $map: {
                        input: "$admin_ids",
                        as: "id",
                        in: { $toObjectId: "$$id"}
                    }
                },
                member_ids: {
                    $map: {
                        input: "$member_ids",
                        as: "id",
                        in: { $toObjectId: "$$id"}
                    }
                }
            }
        },
        {
            $lookup: {
                from: "Users",
                localField: "admin_ids",
                foreignField: "_id",
                as: "admins"
            }
        },
        {
            $lookup: {
                from: "Users",
                localField: "member_ids",
                foreignField: "_id",
                as: "members"
            }
        },
        {
            $project: {
                admin_ids: 0,
                member_ids: 0
            }
        }
    ]
    const response = await Events.aggregate(pipeline).toArray()
    return response[0]
}

export const UpdateEventByID = async (_id: string, setOperation: {[propName: string]: any}): Promise<boolean> => {
    const Events = db.collection('Events')
    const query = {_id: new ObjectId(_id)}
    const update = {$set:setOperation}
    const response = await Events.updateOne(query, update)
    console.log(response)
    return response.result.ok === 1
}

// Helpers

const MapUserToId = (event: BaseEvent, users: UserDocInternal[]) => {
    let UserMap: {[propName: string]: UserDocInternal} = {}
    users.forEach(x => {
        const {_id} = x
        UserMap[_id.toString()] = x
    })
    event.admin_ids = event.admin_ids.map(id => UserMap[id as string])
    if(event.member_ids.length > 0){
        event.member_ids = event.member_ids.map(id => UserMap[id as string])
    }
    return event
}
