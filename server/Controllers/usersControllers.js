import moment from "moment" //A JavaScript date library/package for formatting dates.
import { users } from "../models/usersSchema.js"
import csv from "fast-csv"
import fs from "fs"
import { uploadOnCloudinary } from "../utilities/cloudinary.js"

export const userRegister = async (req, res) => {

    const file = req.file.filename

    const { fname, lname, email, mobile, gender, location, status } = req.body

    if (!fname || !lname || !email || !mobile || !gender || !location || !status || !file) {
        return res.status(400).json("all fields are required")
    }

    try {
        let user = await users.findOne({ email: email })
        console.log("user==>", user)//not present then null otherwise {...}
        if (user) {
            return res.status(400).json({ message: "user email already exists" })
        } else {
            const dateCreated = moment(new Date()).format("YYYY-MM-DD hh:mm:ss")
            console.log("date created ==>", dateCreated)// is of string type
            const uploadImage = await uploadOnCloudinary(process.cwd() + "/uploads/" + file)
            if (!uploadImage) {
                return res.status(500).json({ message: "profile image not uploaded! plz try again!" })
            }

            const userData = new users({
                fname, lname, email, mobile, gender, location, status, profile: uploadImage?.url||"", dateCreated
            })
            // before saving validation of schema happens, if error occurs it will be passed to the catch block
            await userData.save()
            return res.status(201).json(userData)
        }
    } catch (error) {
        console.log(error.message)
        return res.status(500).json(error.message)
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const getAllUsers = async (req, res) => {
    // console.log("getAllUsers import.meta.dirname", import.meta.dirname)
    // console.log("getAllUsers import.meta.filename", import.meta.filename)
    // console.log("getAllUsers process.cwd()", process.cwd())
    // query: { search: 's', gender: 'All', status: 'InActive', sort: 'new' } & params: {}
    const search = req.query.search || ""
    const gender = req.query.gender || ""
    const status = req.query.status || ""
    const sort = req.query.sort || ""
    const dateRange = req.headers["date-range"]
    let start = dateRange?.split("--")[0] + "T00:00:00Z"
    let end = dateRange?.split("--")[1] + "T23:59:59Z"
    const page = req.query.page || 1
    const ITEM_PER_PAGE = 4

    const query = {
        fname: { $regex: search, $options: "i" }
    }
    if (gender !== "All") {
        query.gender = gender
    }
    if (status !== "All") {
        query.status = status
    }
    if (dateRange !== "") {
        query.dateCreated = { $gte: start, $lte: end }
    }
    try {
        const count = await users.countDocuments(query)
        const skip = (page - 1) * ITEM_PER_PAGE
        const usersData = await users.find(query).skip(skip).limit(ITEM_PER_PAGE)
        // .sort({ dateCreated: sort == "new" ? -1 : 1 })
        const pageCount = Math.ceil(count / ITEM_PER_PAGE)//pageCount is total pages
        res.status(200).json({
            pagination: {
                count, pageCount
            },
            usersData
        })
    } catch (error) {
        res.status(500).json(error)
        console.log(error.message)
    }
}


export const getSingleUser = async (req, res) => {
    const { id } = req.params
    console.log(id)
    try {
        const usersData = await users.findOne({ _id: id })
        res.status(200).json(usersData)

    } catch (error) {
        res.status(500).json(error)
    }
}

export const editUser = async (req, res) => {
    const { id } = req.params
    const { fname, lname, email, mobile, gender, location, status, user_profile } = req.body
    const file = req.file ? req.file.filename : user_profile
    //data.append("user_profile", image)
    const dateUpdated = moment(new Date()).format("YY-MM-DD hh:mm:ss")
    try {
        const updateUser = await users.findByIdAndUpdate({ _id: id }, {

            fname, lname, email, mobile, gender, location, status, profile: file, dateUpdated
        }, {
            new: true
        }
        )
        await updateUser.save()
        res.status(200).json(updateUser)

    } catch (error) {
        res.status(500).json(error.message)
        console.log(error)
    }
}


export const deleteUser = async (req, res) => {
    const { id } = req.params
    console.log(id)
    try {
        const deletedData = await users.findByIdAndDelete({ _id: id })
        res.status(200).json(deletedData)

    } catch (error) {
        res.status(500).json(error)
    }
}

export const changeStatus = async (req, res) => {
    const { id } = req.params
    const { data } = req.body

    console.log(id)
    try {
        const changedStatus = await users.findByIdAndUpdate({ _id: id }, { status: data }, { new: true })
        res.status(200).json(changedStatus)

    } catch (error) {
        res.status(500).json(error)
    }
}


export const getMetaData = async (req, res) => {
    try {
        const metaData1 = await users.aggregate(
            [
                {
                    $match: {
                        gender: "Male"
                    }
                },
                {
                    $count: "maleCount"
                }
            ],

        )

        const metaData2 = await users.aggregate(
            [
                {
                    // match stage
                    $match: {
                        gender: "Female"
                    }
                },
                {
                    $count: "femaleCount"
                }
            ],

        )

        let male = metaData1[0]?.maleCount
        let female = metaData2[0]?.femaleCount


        res.status(200).json({ male, female })

    } catch (error) {
        console.log(error.message)
        res.status(500).json(error)
    }
}

export const exportCsv = async (req, res) => {
    try {


        const usersData = await users.find()

        const csvStream = csv.format({ headers: true })

        console.log(fs.existsSync("csv"))

        if (!fs.existsSync("csv")) {
            fs.mkdirSync("csv")
            if (fs.existsSync("csv")) {
                fs.mkdirSync("csv/files")
            }
        }

        const writableStream = fs.createWriteStream(
            "csv/files/users.csv"
        )

        csvStream.pipe(writableStream)

        writableStream.on("finish", () => {
            res.status(200).json({ downloadUrl: `http://localhost:3001/csv/files/users.csv` })

        })

        if (usersData.length > 0) {
            usersData.map(e => {
                csvStream.write({
                    Firstname: e.fname ? e.fname : "-"
                })
            })
        }

        csvStream.end()
        writableStream.end()





    } catch (error) {
        console.log(error)
        res.status(500).json(error.message)
    }
}
