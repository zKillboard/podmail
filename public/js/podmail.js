var currentFolder = 1;
var currentPage = 0;
var currentMail = 0;
var click = false;
var deltaCount = 1;
var deltaCurrent = null;
$( document ).ready(docReady);

function docReady()
{
    loadFolders();
    setTimeout('nextDelta();', 1000);
    $('.gre').gre();
    $('#left-hamburger').click(function() { leftBurgerClicked(); } );
    toggleFolders();
    if (window.location.pathname != '/about') pushState('/folder/1');
    checkSessionStorage();
    $("#search").on("change", search);
}

$( window ).resize(function() { toggleFolders(); });

function leftBurgerClicked()
{
    $("#col-menu").toggle();
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#listing").hide();
        $("#compose").hide();
        $("#mail").hide();
    }
    if (width < 768 && $("#col-menu").css("display") == "none") $("#listing").show();
}

function toggleFolders() {
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#col-menu").removeClass("col-2").removeClass("col-12").addClass("col-12").hide();
        $("#col-content").removeClass("col-10").removeClass("col-12").addClass("col-12").show();
        $("#left-hamburger").prop('disabled', false);
    } else {
        $("#col-menu").removeClass("col-2").removeClass("col-12").addClass("col-2").show();
        $("#col-content").removeClass("col-10").removeClass("col-12").addClass("col-10").show();
        $("#left-hamburger").prop('disabled', true);
    }
}

function loadFolders() {
    $("#pre-folders").load("/folders", loadedFolders);
}

function loadedFolders()
{
    loadFolder(currentFolder, currentPage);
}

function loadFolderClick(id)
{
    click = true;
    currentPage = 0;
    currentMail = 0;
    loadFolder(id);
}

function loadFolder(id, page)
{
    var url = "/folder/" + id + '/' + page;
    currentFolder = id;
    $("#listing").load(url, folderLoaded);
}

function loadPage(id, page)
{
    currentFolder = id;
    currentPage = page;
    $("#listing").load("/folder/" + id + '/' + page, folderLoaded);
}

function folderLoaded()
{
    $(".folder-link").css("font-weight", "");
    $(".folder-" + currentFolder).css("color", "#800000");
    $(".tooltip-inner").remove();

    $(".subjectrow").click(function() { mailClick(this); return false; } );
    $("#folders").html($("#pre-folders").html());
    $("#compose-start").click(function() { compose(); return false; });
    $("#compose-target").click(function() { compose_target(); return false; });
    $(".folder-link").click(function (e) { loadFolderClick($(this).attr('folder')); return false; });
    if (click) {
        $("#mail").hide();
        $("#listing").show();
        $("#compose").hide();
        click = false;

        var width = parseInt($("body").css("width"));
        if (width <= 768) {
            $("#col-menu").hide();
        }
        pushState('/folder/' + currentFolder);
    }

    if (currentPage > 0) $('#prevpage').click(function() { loadPage(currentFolder, (currentPage - 1)); pushState("/folder/" + currentFolder + "/" + (currentPage - 1)); return false; });
    else $('#prevpage').removeAttr('href');
    if (currentPage < ($('#nextpage').attr('max') - 1)) $('#nextpage').click(function() { loadPage(currentFolder, (currentPage + 1)); pushState("/folder/" + currentFolder + "/" + (currentPage + 1)); return false; });
    else $('#nextpage').removeAttr('href');

    $("#folder-id-content").css("display", "block");
    $('[data-toggle="tooltip"]').tooltip()

        $("#mass-checkbox").click(function() { $(".mail-checkbox").prop('checked', $(this).prop('checked')); setMassButtons(); });
    $(".mail-checkbox").click(function() { setMassButtons(); });
    $("#mass-read").click(function() { massSetRead('true'); $(this).blur(); });
    $("#mass-unread").click(function() { massSetRead('false'); $(this).blur(); });
    $("#mass-delete").click(function() { $(this).blur(); }).confirm({title:'Deleting multiple EveMails', content: 'This action CANNOT be undone!<br/>Are you sure?', type: 'red', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'DELETE', action: function() { massDelete(); } }, noop:{text:'Dismiss', action: function() {} }}});
    currentMail = 0;
}

function setMassButtons()
{
    var count = $(".mail-checkbox:checked").length;
    var isDisabled = (count == 0);
    $("#mass-delete").prop('disabled', isDisabled);
    $("#mass-read").prop('disabled', isDisabled);
    $("#mass-unread").prop('disabled', isDisabled);
}

function massSetRead(is_read)
{
    $(".mail-checkbox:checked").each(function() {
            mail_id = $(this).attr('mail_id');
            if (is_read == 'true') $(".mail-" + mail_id).removeClass('unread');
            else $(".mail-" + mail_id).addClass('unread');
            $.ajax('/action/mail/' + mail_id + '/is_read/' + is_read, {method: 'post'});
            });
    setTimeout("forceDelta();", 3000);
}

function massDelete()
{
    $(".mail-checkbox:checked").each(function() {
            mail_id = $(this).attr('mail_id');
            $("#mail-" + mail_id).addClass('strike');
            //$("#div-mail-" + mail_id).hide();
            $.ajax('/action/mail/' + mail_id + '/delete/now', {method: 'post', complete: mailDeleted});
            });
    setTimeout("forceDelta();", 1000);
}

function mailClick(o)
{
    $("#mail").load(o.href, mailLoaded);
}

function mailLoaded(o)
{
    $("#showlisting").click(function() { history.back(); return false; });
    $('#unread_btn').click(function() { markMailUnread(this); $(this).blur(); });
    $('#delete_btn').click(function() { $(this).blur(); }).confirm({title:'Deleting an EveMail', content: 'This action CANNOT be undone!<br/>Are you sure?', type: 'red', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'DELETE', action: function() { deleteMail($('#delete_btn'));  } }, noop:{text:'Dismiss', action: function() {} }}});
    $("#reply_btn").click(function() { reply(); $(this).blur(); return false; });
    $("#reply_all_btn").removeAttr("disabled").click(function() { reply_all(); $(this).blur(); return false; });
    $("#forward_btn").click(function() { forward(); $(this).blur(); return false; });
    $("#unread").hide();
    $("#listing").hide();
    $("#mail").show();
    $("#mail-id-content").css("display", "block");
    $('[data-toggle="tooltip"]').tooltip()
        var mail_id = $("#mail-id").html();
    currentMail = mail_id;
    pushState('/mail/' + mail_id);
}

function markMailUnread(btn)
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('unread');
    $("#unread").fadeIn(100).fadeOut(100).fadeIn(100).fadeOut(100).fadeIn(100);
    $.ajax('/action/mail/' + mail_id + '/is_read/false', {method: 'post'});
    setTimeout("forceDelta();", 3000);
}

function deleteMail(btn) 
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('strike');
    //$("#div-mail-" + mail_id).hide();
    $.ajax('/action/mail/' + mail_id + '/delete/now', {method: 'post', complete: mailDeleted});
    setTimeout("forceDelta();", 3000);
}

function mailDeleted()
{
    showListing();
}

function showListing()
{
    $("#mail").hide();
    $("#listing").show();
    $("#compose").hide();
}

function checkDelta()
{
    if (window.location.pathname == "/about") return;
    $.ajax('/delta', {success: processDelta, complete: nextDelta });
    nextDelta();
}

var delta_timeouts = [];
function nextDelta()
{
    // Clear existing delta timeouts
    for (var i = 0; i < delta_timeouts.length; i++) {
        clearTimeout(delta_timeouts[i]);
    }
    //quick reset of the timer array you just cleared
    delta_timeouts = [];

    delta_timeouts.push(setTimeout('checkDelta();', deltaCount * 1000));
}

function forceDelta()
{
    return;
    processDelta(JSON.stringify({delta:'0'}));
}

function processDelta(data)
{
    console.log(data);
    if (data.refresh == true) {
        window.location = '/';
        return;
    } else if (data.logout == true) {
        window.location = '/logout';
        return;
    } else if (deltaCurrent != data.delta) {
        deltaCurrent = data.delta;
        loadFolders();
        deltaCount = 1;
        if (data.notification) htmlNotify(data.notification);
    } else if (deltaCount < 30) deltaCount++;
    if (data.name != $("#char-name").html() && data.id > 0) {
        $("#char-name").html(data.name);
        image = "https://imageserver.eveonline.com/Character/" + data.id + "_32.jpg";
        if ($("#char-image").attr("src") != image) $("#char-image").attr("src", "https://imageserver.eveonline.com/Character/" + data.id + "_32.jpg");
    }
}

$(document).on('submit', '#compose_form', function() {            
        $("#compose-btn").attr("disabled", "disabled");
        $.ajax({
url     : $(this).attr('action'),
type    : $(this).attr('method'),
dataType: 'json',
data    : $(this).serialize(),
success : function( data ) {
if (data.error == false) {
$.confirm({title:'Sending EveMail...', content: data.message, type: 'green', useBootstrap: true, autoClose: 'noop|3000', backgroundDismiss:true, escapeKey:true, buttons: {noop:{text:'Dismiss', action: function() {} }}});
$("#mail").hide();
$("#compose").hide();
$("#listing").show();
} else {
$.dialog({title: 'Sending EveMail...', content: data.message, type: 'red'});
}
$("#compose-btn").removeAttr("disabled")
},
error   : function( xhr, err ) {
//console.log(err);
alert('Error');     
$("#compose-btn").removeAttr("disabled");
}
});    
return false;
});

function compose_prepare(recips = '', subject = '', body = '')
{
    $("#recipients").val(recips);
    $("#subject").val(subject);
    $("iframe").remove();
    $("#body").val(body);
    $(".gre").gre();
    $("#cancel-compose").click(function() { history.back(); return false; });
    pushState("/compose");
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#col-menu").hide();
    }

}

function compose_show()
{
    $("#listing").hide();
    $("#mail").hide();
    $("#compose").show();
}

function compose()
{
    compose_prepare();
    compose_show();
    $("#recipients").focus();
}  

function uniqueness(names) 
{
    var uniqueNames = [];
    $.each(names, function(i, el){
            el = el.trim();
            if($.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
            });
    return uniqueNames;
}

function array_delete(array, element)
{
    var index = array.indexOf(element);
    if (index > -1) {
        array.splice(index, 1);
    }
    return array;
}

function compose_target()
{
    compose_prepare($("#compose-target").attr("compose-target"), "", "");
    compose_show();
    $("#subject").focus();
}

function reply()
{
    compose_prepare($("#mail-from").html(), "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
}

function reply_all()
{
    var tos = $("#mail-from").html() + ", " + $("#mail-to").html();
    tos = uniqueness(tos.split(","));
    tos = array_delete(tos, character_name);
    compose_prepare(tos.join(', '), "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
}

function forward()
{
    compose_prepare('', "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
    $("#recipients").focus();
}

$(window).on("popstate", pop_state);
function pop_state(e)
{
    if (e.originalEvent.state !== null) state = e.originalEvent.state;
    else state = e.state;

    if (state.currentMail != 0) {
        $("#mail").load(location.href, mailLoaded);
        $("#listing").hide();
        $("#compose").hide();
        $("#mail").show();
    } else {
        loadFolder(state.currentFolder, state.currentPage);
        $("#mail").hide();
        $("#compose").hide();
        $("#listing").show();
    }
    return false;
}

var lastState = null;
function pushState(newURL)
{
    if (newURL == lastState) return;
    lastState = newURL;
    state = {currentFolder: currentFolder, currentPage: currentPage, currentMail: currentMail};
    history.pushState(state, '', newURL);
}

function checkSessionStorage()
{
    var mail_id = sessionStorage.getItem("mail_id");
    var folder_id = sessionStorage.getItem("folder_id");
    sessionStorage.removeItem("mail_id");
    sessionStorage.removeItem("folder_id");
    if (mail_id) {
        $("#mail").load('/mail/' + mail_id, mailLoaded);
        $("#listing").hide();
        $("#compose").hide();
        $("#mail").show();
        return;
    }
    if (folder_id) {
        loadFolderClick(folder_id);
        $("#mail").hide();
        $("#compose").hide();
        $("#listing").show(); 
    }
}

var notifsDisplayed = [];
function htmlNotify (data)
{
    var width = parseInt($("body").css("width"));
    if("Notification" in window && width > 768) { // Don't bother on mobile devices
        if (Notification.permission !== 'denied' && Notification.permission !== "granted") {
            Notification.requestPermission(function (permission) {
                    if (permission === 'granted') htmlNotify(data);
                    });
            return;
        }
        if (Notification.permission === 'granted') {
            if (notifsDisplayed.indexOf(data.uniqid) != -1) return;
            if (window.location.pathname == "/about") return;
            if (data.unixtime < (Math.floor(new Date().getTime() / 1000) - 180)) return;
            notifsDisplayed = []; // prevent tiny memory leak
            notifsDisplayed.push(data.uniqid);
            var notif = new Notification(data.title, {body: data.message, icon: data.image});
            setTimeout(function() { notif.close() }, 20000);
            notif.onclick = function () { notif.close(); mailClick({href: '/mail/' + data.mail_id}); window.focus();};
        }
    }
}

function applyTheme(theme)
{
    $.ajax("/user/theme/" + theme, { complete : function () { window.location = window.location; }});
}

function search()
{
    // jQuery.post( url [, data ] [, success ] [, dataType ] )
    $("#listing").load("/search", { search : $("#search").val() }, noop);
}

function noop(data)
{
    console.log('no op');
    $("#listing").html(data);
    console.log(data);
}

function searchComplete(data)
{
    console.log(data);
}


