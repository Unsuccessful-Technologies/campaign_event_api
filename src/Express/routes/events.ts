import {NextFunction, Request, Response, Router} from "express";
import {ObjectId} from 'bson'
import {
    AggBaseEvent,
    BaseEvent,
    BaseEventRaw,
    EventType,
    NewEventBody,
    TokenPayload,
    UserDocInternal
} from "../../interfaces";
import {verify} from "jsonwebtoken";
import config from "../../config";
import {
    CreateEvent,
    CreateOrganization,
    CreateUser, CreateUserSpaceHolder,
    GetEventByID,
    GetManyUsers,
    GetUserByEmail,
    UpdateEventByID
} from "../../Database";
import {GetPayloadHeader, isAuthentic} from "./auth";
import {SESV2} from 'aws-sdk'

const router = Router()

const NewEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    const body: NewEventBody = req.body
    const payload = GetPayloadHeader(req)
    const {user_id} = payload
    const user_obj_id: ObjectId = new ObjectId(user_id)
    let organization_id: ObjectId
    try {
        if(body.organization_id && body.organization_id !== "new"){
            organization_id = new ObjectId(body.organization_id)
        }else if(body.organization){
            let new_organization = await CreateOrganization({...body.organization, created_by_id: user_obj_id})
            organization_id = new ObjectId(new_organization._id)
        }
        const base_event = MakeBaseEvent(user_obj_id, organization_id, body.event)

        const result = await CreateEvent(base_event)
        res.status(200).json({success:true,...result})
    } catch (e) {
        console.log(e.message)
        res.status(200).json({success:false, message: e.message})
    }
}

const GetEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    const {token} = req.headers
    const {event_id} = req.params
    const eventDoc = await GetEventByID(event_id)

    const CanUserSeeEvent = (token: string, eventDoc: AggBaseEvent): boolean => {
        if(!token) return false
        const user_id = GetUserId(token).toString()
        const allowed_ids: {[propName:string]: boolean} = {}
        allowed_ids[eventDoc.created_by_id.toString()] = true
        eventDoc.admins.forEach(x => {
            allowed_ids[x._id.toString()] = true
        })
        eventDoc.members.forEach(x => {
            allowed_ids[x._id.toString()] = true
        })
        return !!allowed_ids[user_id]
    }


    try {
        if(eventDoc){
            if(eventDoc.is_private){
                if(CanUserSeeEvent(<string>token, eventDoc)){
                    res.status(200).json(eventDoc)
                } else {
                    res.status(403).json({message: "Not Allowed. Private Event."})
                }
            } else {
                res.status(200).json(eventDoc)
            }
        } else {
            res.status(404).json({message:"No Event Found"})
        }
    } catch(e) {
        console.log(e.message)
        res.status(500).json({message: e.message})
    }


}

const UpdateEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    const {event_id} = req.params
    const { body } = req
    const payload: TokenPayload = GetPayloadHeader(req)
    const {user_id} = payload

    const eventDoc = await GetEventByID(event_id)

    try {
        if(eventDoc){
            if(isUserAdmin(user_id, eventDoc)){
                const result = await UpdateEventByID(event_id, body)
                res.status(200).json({success: result})
            } else {
                res.status(403).json({message: "Not Allowed."})
            }
        } else {
            res.status(404).json({message:"No Event Found"})
        }
    } catch(e) {
        console.log(e.message)
        res.status(500).json({message: e.message})
    }

}

const SendInviteHandler = async (req: Request, res: Response, next: NextFunction) => {
    // TODO Plug in Email Solution

    res.send(200).json({message:"Under Construction"})

    const { body, params } = req
    const { event_id } = params
    const { email, message } = body
    const email_params = {
        FromEmailAddress: "owner@unsuccessfultech.com",
        Destination: {
            ToAddresses: [email]
        },
        Content: {
            Simple:{
                Subject: {
                    Data: `Please join my event with id ${event_id}`,
                    Charset: "UTF-8"
                },
                Body: {
                    Html: {
                        Data: `
                            Please <a href="https://glenburchfield.com">Go here</a>
                        `,
                        Charset: "UTF-8"
                    }
                }
            }
        }
    }
    try {
        // const sesv2 = new SESV2(config.aws.ses_options)
        // sesv2.sendEmail(email_params, (err, response) => {
        //     if(err){
        //         throw err
        //     } else {
        //         console.log(response)
        //         res.status(200).json(response)
        //     }
        // })
    } catch(e) {
        console.log(e)
        res.status(500).json(e)
    }
}

const AddUserHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { body, params } = req
    const { type, email } = body
    const { event_id } = params
    const payload: TokenPayload = GetPayloadHeader(req)
    const {user_id} = payload
    try {
        if( !(type === 'admin' || type === 'member') ){
            res.status(400).json({message: "Invalid Type"})
        }
        const user = await GetUserByEmail(email)
        const eventDoc = await GetEventByID(event_id)
        let new_user_id = null

        if(user){
            new_user_id = user._id
        } else {
            new_user_id = await CreateUserSpaceHolder(email)
        }

        switch(type) {
            case 'admin': {
                if(isUserAdmin(user_id,eventDoc)){
                    const admin_ids = createNewUserArr(eventDoc.admins,new_user_id.toString())
                    const result = await UpdateEventByID(event_id, {admin_ids})
                    res.status(200).json({success: result, ids:[event_id]})
                } else {
                    throw {
                        status: 403,
                        message: "Not Allowed"
                    }
                }
                break;
            }
            case 'member': {
                if(!eventDoc.is_private || (isUserAdmin(user_id,eventDoc) || isUserMember(user_id,eventDoc))){
                    const member_ids = createNewUserArr(eventDoc.members,new_user_id.toString())
                    const result = await UpdateEventByID(event_id, {member_ids})
                    res.status(200).json({success: result, ids:[event_id]})
                } else {
                    throw {
                        status: 403,
                        message: "Not Allowed"
                    }
                }
                break;
            }
            default: throw {status:400,message:"Bad Request"}
        }
    } catch(e) {
        console.log(e)
        res.status(e.status || 500).json(e)
    }
}

const DeleteUserHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { body, params } = req
    const { type, email } = body
    const { event_id } = params
    const payload: TokenPayload = GetPayloadHeader(req)
    const {user_id} = payload
    try {
        if( !(type === 'admin' || type === 'member') ){
            res.status(400).json({message: "Invalid Type"})
        }
        const eventDoc = await GetEventByID(event_id)

        switch(type) {
            case 'admin': {
                if(isUserAdmin(user_id,eventDoc)){
                    const admin_ids: string[] = removeUserFromArr(eventDoc.admins, email)
                    const result = await UpdateEventByID(event_id, {admin_ids})
                    res.status(200).json({success: result, ids:[event_id]})
                } else {
                    throw {
                        status: 403,
                        message: "Not Allowed"
                    }
                }
                break;
            }
            case 'member': {
                if(!eventDoc.is_private || (isUserAdmin(user_id,eventDoc) || isUserMember(user_id,eventDoc))){
                    const member_ids: string[] = removeUserFromArr(eventDoc.members, email)
                    const result = await UpdateEventByID(event_id, {member_ids})
                    res.status(200).json({success: result, ids:[event_id]})
                } else {
                    throw {
                        status: 403,
                        message: "Not Allowed"
                    }
                }
                break;
            }
            default: throw {status:400,message:"Bad Request"}
        }
    } catch(e) {
        console.log(e)
        res.status(e.status || 500).json(e)
    }
}



router.get("/:event_id", GetEventHandler)

router.use(isAuthentic)

router.post("/", NewEventHandler)

router.post("/:event_id", UpdateEventHandler)

router.post('/invite/:event_id', SendInviteHandler)

router.post('/user/:event_id', AddUserHandler)

router.delete('/user/:event_id', DeleteUserHandler)


export default router



const GetUserId = (token:string): ObjectId => {
    const token_payload: TokenPayload = <TokenPayload>verify(token, config.secret)
    if(token_payload){
        return new ObjectId(token_payload.user_id)
    } else {
        throw new Error('Token is invalid')
    }
}

const MakeBaseEvent = (user_id: ObjectId, organization_id: ObjectId, event: BaseEventRaw ): BaseEvent => {
    return {
        created_by_id: user_id,
        ...event,
        is_private: event.is_private === "true",
        admin_ids: [user_id.toString()],
        member_ids: [],
        organization_id
    }
}

const isUserAdmin = (user_id: string, eventDoc: AggBaseEvent): boolean => {
    const allowed_ids: {[propName:string]: boolean} = {}
    eventDoc.admins.forEach(x => {
        allowed_ids[x._id.toString()] = true
    })
    return !!allowed_ids[user_id]
}

const isUserMember = (user_id: string, eventDoc: AggBaseEvent): boolean => {
    const allowed_ids: {[propName:string]: boolean} = {}
    eventDoc.members.forEach(x => {
        allowed_ids[x._id.toString()] = true
    })
    return !!allowed_ids[user_id]
}

const createNewUserArr = (userArr: UserDocInternal[], new_user_id: string) => {
    const arr = []
    userArr.forEach(x => arr.push(x._id.toString()))
    arr.push(new_user_id)
    return arr
}

const removeUserFromArr = (userArr: UserDocInternal[], email: string) => {
    const arr: string[] = []
    userArr.forEach(x => {
        if(x.email !== email){
            arr.push(x._id.toString())
        }
    })
    return arr
}