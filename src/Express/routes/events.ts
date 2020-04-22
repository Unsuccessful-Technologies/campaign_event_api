import {NextFunction, Request, Response, Router} from "express";
import {ObjectId} from 'bson'
import {BaseEvent, BaseEventRaw, EventType, NewEventBody, TokenPayload} from "../../interfaces";
import {verify} from "jsonwebtoken";
import config from "../../config";
import {CreateEvent, CreateOrganization, CreateUser, GetEventByID, UpdateEventByID} from "../../Database";
import {GetPayloadHeader, isAuthentic} from "./auth";

const router = Router()

const NewEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    const body: NewEventBody = req.body
    const payload = GetPayloadHeader(req)
    const {user_id} = payload
    const user_obj_id: ObjectId = new ObjectId(user_id)
    let organization_id: ObjectId
    console.log("\n\n",body,"\n\n")
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

    const CanUserSeeEvent = (token: string, eventDoc: BaseEvent): boolean => {
        if(!token) return false
        const user_id = GetUserId(token).toString()
        return eventDoc.view_ids.includes(user_id)
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

    const CanUserEditEvent = (user_id: string, eventDoc: BaseEvent): boolean => {
        return eventDoc.admin_ids.includes(user_id)
    }

    try {
        if(eventDoc){
            if(CanUserEditEvent(user_id, eventDoc)){
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


router.get("/:event_id", GetEventHandler)

router.use(isAuthentic)

router.post("/", NewEventHandler)

router.post("/:event_id", UpdateEventHandler)

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
        view_ids: [],
        member_ids: [],
        organization_id
    }
}