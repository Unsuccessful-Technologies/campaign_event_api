
import { MongoClient, Db, ObjectId} from "mongodb";
import config from "../config";
import {
    AggBaseEvent,
    BaseEvent,
    CreateUserPayload,
    FundRaiseEventDoc,
    Organization,
    OrganizationDoc, TicketedEventDoc,
    UserDocInternal, UserSpaceHolder
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
    const userScrubbed: CreateUserPayload = {
        fName: payload.fName.toLowerCase(),
        lName: payload.lName.toLowerCase(),
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        password: payload.password
    }
    const response = await Users.insertOne(userScrubbed)
    const result = {
        ...payload,
        _id: response.insertedId
    }
    return result
}

export const CreateUserSpaceHolder = async (email: string): Promise<UserSpaceHolder> => {
    const UserSpaceHolders = db.collection('UserSpaceHolders')
    const userScrubbed: UserSpaceHolder = {
        _id: new ObjectId(),
        email: email,
        notJoined: true
    }
    const response = await UserSpaceHolders.insertOne(userScrubbed)
    const result = response.insertedId
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
    const query = {email: email.toLowerCase()}
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
                $or: [
                    {created_by_id: new ObjectId(user_id)},
                    {admin_ids: user_id.toString()},
                    {member_ids: user_id.toString()}
                ]
            }
        },
        ...EventPipeline
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
        ...EventPipeline
    ]
    const response = await Events.aggregate(pipeline).toArray()
    return response[0]
}

export const GetPublicEvents = async (): Promise<AggBaseEvent[]> => {
    const Events = db.collection('Events')
    const pipeline: Object [] = [
        {
            $match: {
                $or: [
                    {is_private: false},
                    {is_private: "false"}
                ]
            }
        },
        ...EventPipeline
    ]
    const response = await Events.aggregate(pipeline).toArray()
    return response
}

export const UpdateEventByID = async (_id: string, setOperation: {[propName: string]: any}): Promise<boolean> => {
    const Events = db.collection('Events')
    const query = {_id: new ObjectId(_id)}
    const update = {$set:setOperation}
    const response = await Events.updateOne(query, update)
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

const EventPipeline = [
    {
        $lookup: {
            from: "Organizations",
            let: {id: "$organization_id"},
            pipeline: [
                {
                    $match: {
                        $expr: { $eq: ["$_id","$$id"]}
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        description: 1
                    }
                }
            ],
            as: "organization"
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
            },
            organization: { $arrayElemAt: ["$organization",0]}
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
            from: "UserSpaceHolders",
            localField: "admin_ids",
            foreignField: "_id",
            as: "admin_space_holders"
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
        $set : {
            admins: {
                $concatArrays: ["$admins", "$admin_space_holders"]
            }
        }
    },
    {
        $project: {
            admin_ids: 0,
            member_ids: 0,
            admin_space_holders: 0
        }
    }
]
