const mongoose = require('mongoose');

const connectDatabase = async () => {
    try{
        await mongoose.connect("mongodb+srv://lekhanh98777:khanhle2004@cluster0.rzo0p3f.mongodb.net/", {
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000 // Tăng timeout lên 30 giây
        });
        console.log("kết nối database thành công");
    }
    catch(err){
        console.log(err);
    }
} 

module.exports = connectDatabase;